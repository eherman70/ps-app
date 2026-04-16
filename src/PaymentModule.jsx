import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Download, FileText, Plus, Save, Search } from 'lucide-react';
import { filterItemsByPS, getScopedPS } from './utils';

function PaymentModule() {
  const { darkMode, currentUser, activePS } = useAppContext();
  const { items: farmers } = useStorage('farmer');
  const { items: tickets } = useStorage('ticket');
  const { items: inputs } = useStorage('issuedinput');
  const { items: inputTypes } = useStorage('inputtype');
  const { items: seasons } = useStorage('season');
  const { items: saleNumbers } = useStorage('salenumber');
  const { items: payments, refreshItems: refreshPayments } = useStorage('payment');
  const { items: primarySocieties } = useStorage('ps');

  const getPsName = (code) => {
    if (!code || code === 'All') return code;
    const match = primarySocieties.find(p => p.code === code);
    return match ? match.name : code;
  };
  const role = (currentUser?.role || '').toLowerCase();
  const isSupervisor = role === 'admin' || role === 'supervisor';
  const scopedPS = getScopedPS(currentUser, activePS);

  const [selectedSeason, setSelectedSeason] = useState('');
  const [psFilter, setPsFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [exchangeRates, setExchangeRates] = useState({ byPs: {} });
  const [globalRate, setGlobalRate] = useState(0);
  const [ratePs, setRatePs] = useState('');
  const [rateValue, setRateValue] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  const [deductions, setDeductions] = useState({ byPs: {} });
  const [deductionPs, setDeductionPs] = useState('');
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionForm, setDeductionForm] = useState({ name: '', amount: '', type: 'Per Farmer' });
  const [savingDeduction, setSavingDeduction] = useState(false);
  const [selectedFarmerIds, setSelectedFarmerIds] = useState([]);
  const [savingPayments, setSavingPayments] = useState(false);
  const [lastPaidRows, setLastPaidRows] = useState([]);
  const [lastPaidAt, setLastPaidAt] = useState('');
  const [pendingFarmerPrint, setPendingFarmerPrint] = useState(false);
  const PAYMENT_EPSILON = 0.01;

  useEffect(() => {
    if (seasons.length && !selectedSeason) {
      setSelectedSeason(seasons[0].id || seasons[0].name);
    }
  }, [seasons, selectedSeason]);

  useEffect(() => {
    if (isSupervisor) {
      setPsFilter(scopedPS && scopedPS !== 'All' ? scopedPS : 'All');
      return;
    }

    setPsFilter(scopedPS || 'All');
  }, [isSupervisor, scopedPS]);

  useEffect(() => {
    const defaultPs = (activePS && activePS !== 'All')
      ? activePS
      : (currentUser?.ps && currentUser.ps !== 'All' ? currentUser.ps : '');
    if (defaultPs) {
      setRatePs(defaultPs);
      setDeductionPs(defaultPs);
    }
  }, [activePS, currentUser]);

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (ratePs) {
      setRateValue(exchangeRates.byPs?.[ratePs] ? String(exchangeRates.byPs[ratePs]) : '');
    }
  }, [ratePs, exchangeRates]);

  useEffect(() => {
    const clearPrintMode = () => {
      document.body.classList.remove('printing-payment-only');
      document.body.classList.remove('printing-farmer-payment-only');
    };

    window.addEventListener('afterprint', clearPrintMode);
    return () => {
      clearPrintMode();
      window.removeEventListener('afterprint', clearPrintMode);
    };
  }, []);

  const handlePrintPayment = () => {
    document.body.classList.add('printing-payment-only');
    window.print();
  };

  const loadConfigs = async () => {
    try {
      const [rateCfg, deductionCfg, globalRateCfg] = await Promise.all([
        window.api.request('/exchange-rates').catch(() => ({ byPs: {} })),
        window.api.request('/tzs-deductions').catch(() => ({ byPs: {} })),
        window.api.request('/exchange-rate').catch(() => ({ rate: '' }))
      ]);
      setExchangeRates(rateCfg && rateCfg.byPs ? rateCfg : { byPs: {} });
      setDeductions(deductionCfg && deductionCfg.byPs ? deductionCfg : { byPs: {} });
      const gr = parseFloat(globalRateCfg?.rate || 0);
      if (gr > 0) setGlobalRate(gr);
    } catch (e) {
      console.error('Failed to load payment configs:', e);
    }
  };

  const saveRateForPs = async () => {
    if (!isSupervisor) return;
    if (!ratePs) return alert('Select PS first');
    if (!rateValue || parseFloat(rateValue) <= 0) return alert('Enter valid exchange rate');

    setSavingRate(true);
    try {
      const next = {
        byPs: {
          ...(exchangeRates.byPs || {}),
          [ratePs]: parseFloat(rateValue)
        }
      };
      const saved = await window.api.request('/exchange-rates', {
        method: 'POST',
        body: JSON.stringify(next)
      });
      setExchangeRates(saved);
    } catch (e) {
      alert('Failed to save exchange rate: ' + e.message);
    }
    setSavingRate(false);
  };

  const addDeduction = async () => {
    if (!isSupervisor) return;
    if (!deductionPs) return alert('Select PS first');
    if (!deductionForm.name.trim()) return alert('Enter deduction name');
    if (!deductionForm.amount || parseFloat(deductionForm.amount) <= 0) return alert('Enter valid amount');

    setSavingDeduction(true);
    try {
      const nextRow = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}`,
        name: deductionForm.name.trim(),
        amount: parseFloat(deductionForm.amount),
        type: deductionForm.type
      };

      const next = {
        byPs: {
          ...(deductions.byPs || {}),
          [deductionPs]: [
            ...(deductions.byPs?.[deductionPs] || []),
            nextRow
          ]
        }
      };

      const saved = await window.api.request('/tzs-deductions', {
        method: 'POST',
        body: JSON.stringify(next)
      });
      setDeductions(saved);
      setDeductionForm({ name: '', amount: '', type: 'Per Farmer' });
      setShowDeductionForm(false);
    } catch (e) {
      alert('Failed to save deduction: ' + e.message);
    }
    setSavingDeduction(false);
  };

  const filteredFarmers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const scoped = filterItemsByPS(farmers, scopedPS);
    const psScoped = (isSupervisor && psFilter !== 'All')
      ? scoped.filter(f => f.ps === psFilter)
      : scoped;

    if (!q) return psScoped;
    return psScoped.filter(f =>
      `${f.farmerNumber || ''} ${f.firstName || ''} ${f.lastName || ''} ${f.ps || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [farmers, search, scopedPS, isSupervisor, psFilter]);

  const availablePsFilters = useMemo(() => {
    const scoped = filterItemsByPS(farmers, scopedPS);
    return Array.from(new Set(scoped.map(f => f.ps).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [farmers, scopedPS]);

  const selectedSeasonObj = useMemo(() => (
    seasons.find(s => s.id === selectedSeason || s.name === selectedSeason) || null
  ), [seasons, selectedSeason]);

  const selectedSeasonId = selectedSeasonObj?.id || '';

  const selectedSeasonSaleNumberIds = useMemo(() => {
    if (!selectedSeasonId) return new Set();
    return new Set(
      saleNumbers
        .filter(sn => sn.seasonId === selectedSeasonId)
        .map(sn => sn.id)
    );
  }, [saleNumbers, selectedSeasonId]);

  const seasonScopedTickets = useMemo(() => {
    if (!selectedSeasonId) return tickets;

    if (selectedSeasonSaleNumberIds.size > 0) {
      return tickets.filter(t => selectedSeasonSaleNumberIds.has(t.saleNumberId));
    }

    return tickets.filter(t => t.seasonId === selectedSeasonId || t.season === selectedSeasonObj?.name || t.season === selectedSeason);
  }, [tickets, selectedSeasonId, selectedSeasonSaleNumberIds, selectedSeasonObj, selectedSeason]);

  const rows = useMemo(() => {
    const calculateDeductionAmount = (deduction, mass) => {
      const amount = parseFloat(deduction?.amount || 0);
      const type = String(deduction?.type || '').toLowerCase();
      if (type.includes('kg')) {
        return amount * mass;
      }
      return amount;
    };

    const mappedRows = filteredFarmers.map((farmer) => {
      const farmerTickets = seasonScopedTickets.filter(t => t.farmerId === farmer.id);
      const farmerInputs = inputs.filter(i => i.farmerId === farmer.id && !String(i.description || '').startsWith('[SETTLED]'));

      const mass = farmerTickets.reduce((sum, t) => sum + parseFloat(t.mass || t.netWeight || 0), 0);
      const sales = farmerTickets.reduce((sum, t) => sum + parseFloat(t.value || t.totalValue || 0), 0);

      const inputByType = {};
      const advanceByType = {};
      
      for (const issue of farmerInputs) {
        const inputTypeObj = inputTypes.find(t => t.id === issue.inputTypeId);
        const typeName = issue.inputName || inputTypeObj?.name || 'Other';
        
        const isAdvance = issue.isCashAdvance || issue.inputName?.toLowerCase().includes('advance') || inputTypeObj?.category === 'Cash Advance' || typeName.toLowerCase().includes('advance');
        
        if (isAdvance) {
          advanceByType[typeName] = (advanceByType[typeName] || 0) + parseFloat(issue.totalCost || issue.totalValue || 0);
        } else {
          inputByType[typeName] = (inputByType[typeName] || 0) + parseFloat(issue.totalCost || issue.totalValue || 0);
        }
      }

      const totalInputs = Object.values(inputByType).reduce((sum, value) => sum + value, 0);
      const usdBaki = sales - totalInputs;
      const psRate = parseFloat(exchangeRates.byPs?.[farmer.ps?.trim()] || exchangeRates.byPs?.[farmer.ps] || 0);
      const rate = psRate > 0 ? psRate : globalRate;
      const grossTzs = usdBaki * rate;

      const psDeductions = deductions.byPs?.[farmer.ps] || [];
      const deductionByName = {};
      
      for (const deduction of psDeductions) {
        const name = (deduction.name || 'Deduction').toUpperCase();
        deductionByName[name] = (deductionByName[name] || 0) + calculateDeductionAmount(deduction, mass);
      }
      
      for (const [advName, advAmt] of Object.entries(advanceByType)) {
        const name = advName.toUpperCase();
        deductionByName[name] = (deductionByName[name] || 0) + advAmt;
      }

      const totalTzsDeductions = Object.values(deductionByName).reduce((sum, val) => sum + val, 0);
      const malipoHalisi = grossTzs - totalTzsDeductions;

      return {
        farmer,
        mass,
        sales,
        inputByType,
        usdBaki,
        rate,
        grossTzs,
        deductionByName,
        totalTzsDeductions,
        malipoHalisi
      };
    });

    if (!selectedSeasonId) {
      return mappedRows;
    }

    return mappedRows.filter(row => row.mass > 0 || row.sales > 0 || Object.keys(row.inputByType).length > 0);
  }, [filteredFarmers, seasonScopedTickets, inputs, inputTypes, exchangeRates, deductions, globalRate, selectedSeasonId]);

  useEffect(() => {
    const validIds = new Set(rows.map(row => row.farmer.id));
    setSelectedFarmerIds(prev => prev.filter(id => validIds.has(id)));
  }, [rows]);

  const visibleRowIds = useMemo(() => rows.map(row => row.farmer.id), [rows]);
  const allVisibleSelected = visibleRowIds.length > 0 && visibleRowIds.every(id => selectedFarmerIds.includes(id));

  const farmerPaidTotals = useMemo(() => {
    const totals = {};
    for (const payment of payments) {
      if (payment?.farmerId) {
        totals[payment.farmerId] = (totals[payment.farmerId] || 0) + parseFloat(payment.netPayment || 0);
      }
    }
    return totals;
  }, [payments]);

  const paidFarmerIds = useMemo(() => {
    const ids = new Set();
    Object.entries(farmerPaidTotals).forEach(([farmerId, paid]) => {
      if (paid > PAYMENT_EPSILON) {
        ids.add(farmerId);
      }
    });
    return ids;
  }, [farmerPaidTotals]);

  const paidInViewCount = useMemo(
    () => rows.filter(row => paidFarmerIds.has(row.farmer.id)).length,
    [rows, paidFarmerIds]
  );

  const totalPaidToDateInView = useMemo(
    () => rows.reduce((sum, row) => sum + parseFloat(farmerPaidTotals[row.farmer.id] || 0), 0),
    [rows, farmerPaidTotals]
  );

  const totalRemainingInView = useMemo(
    () => rows.reduce((sum, row) => sum + (parseFloat(row.malipoHalisi || 0) - parseFloat(farmerPaidTotals[row.farmer.id] || 0)), 0),
    [rows, farmerPaidTotals]
  );

  const toggleRowSelection = (farmerId) => {
    setSelectedFarmerIds(prev => (
      prev.includes(farmerId)
        ? prev.filter(id => id !== farmerId)
        : [...prev, farmerId]
    ));
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedFarmerIds(prev => prev.filter(id => !visibleRowIds.includes(id)));
      return;
    }
    setSelectedFarmerIds(Array.from(new Set([...selectedFarmerIds, ...visibleRowIds])));
  };

  const createPaymentPayload = (row, amountToPay) => {
    const inputDeduction = Object.values(row.inputByType || {}).reduce((sum, value) => sum + parseFloat(value || 0), 0);
    return {
      farmerId: row.farmer.id,
      pcnId: null,
      mass: parseFloat(row.mass || 0),
      tobaccoAmount: parseFloat(row.sales || 0),
      inputDeduction,
      usdBalance: parseFloat(row.usdBaki || 0),
      exchangeRate: parseFloat(row.rate || 0),
      tzsGross: parseFloat(row.grossTzs || 0),
      levy: parseFloat(row.deductionByName?.LEVY || 0),
      adminFee: parseFloat(row.deductionByName?.ADMIN_FEE || row.deductionByName?.['ADMIN FEE'] || 0),
      totalDeductions: parseFloat(row.totalTzsDeductions || 0),
      netPayment: parseFloat(amountToPay || 0),
      paymentDate: new Date().toISOString().slice(0, 10),
      ps: row.farmer.ps,
      inputsBreakdown: JSON.stringify(row.inputByType || {}),
      deductionsBreakdown: JSON.stringify(row.deductionByName || {})
    };
  };

  const printPaidBatch = () => {
    document.body.classList.add('printing-farmer-payment-only');
    window.print();
  };

  useEffect(() => {
    if (!pendingFarmerPrint) return;
    if (lastPaidRows.length === 0) return;

    const timer = setTimeout(() => {
      printPaidBatch();
      setPendingFarmerPrint(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [pendingFarmerPrint, lastPaidRows]);

  const payFarmers = async (rowsToPay) => {
    if (!isSupervisor) {
      alert('Only supervisors can initiate payments');
      return;
    }

    if (!rowsToPay.length) {
      alert('Select at least one farmer to pay');
      return;
    }

    setSavingPayments(true);
    try {
      const paidNowRows = [];
      const alreadyPaidRows = [];
      const overpaidRows = [];

      for (const row of rowsToPay) {
        const currentNet = parseFloat(row.malipoHalisi || 0);
        const previouslyPaid = parseFloat(farmerPaidTotals[row.farmer.id] || 0);
        const differenceToPay = currentNet - previouslyPaid;

        if (Math.abs(differenceToPay) < PAYMENT_EPSILON) {
          alreadyPaidRows.push(row);
          continue;
        }

        if (differenceToPay < 0) {
          overpaidRows.push({ row, overpaidBy: Math.abs(differenceToPay) });
          continue;
        }

        const payload = createPaymentPayload(row, differenceToPay);
        await window.api.request('/payments', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        paidNowRows.push({
          ...row,
          amountPaidNow: differenceToPay,
          previouslyPaid,
          currentNet
        });
      }

      if (refreshPayments) {
        await refreshPayments();
      }

      if (paidNowRows.length === 0) {
        const messages = [];
        if (alreadyPaidRows.length > 0) {
          messages.push(`${alreadyPaidRows.length} farmer(s) already fully paid.`);
        }
        if (overpaidRows.length > 0) {
          messages.push(`${overpaidRows.length} farmer(s) already overpaid.`);
        }
        alert(messages.join(' ') || 'No payment was made.');
      } else {
        const paidAt = new Date().toISOString();
        setLastPaidRows(paidNowRows);
        setLastPaidAt(paidAt);
        setSelectedFarmerIds([]);

        const summary = [`Payment successful for ${paidNowRows.length} farmer(s).`];
        if (alreadyPaidRows.length > 0) {
          summary.push(`${alreadyPaidRows.length} already fully paid.`);
        }
        if (overpaidRows.length > 0) {
          summary.push(`${overpaidRows.length} overpaid (skipped).`);
        }

        alert(summary.join(' '));
        setPendingFarmerPrint(true);
      }
    } catch (e) {
      alert('Failed to complete payment: ' + e.message);
    }
    setSavingPayments(false);
  };

  const paySelectedFarmers = async () => {
    const rowMap = new Map(rows.map(row => [row.farmer.id, row]));
    const selectedRows = selectedFarmerIds.map(id => rowMap.get(id)).filter(Boolean);
    await payFarmers(selectedRows);
  };

  const paySingleFarmer = async (row) => {
    await payFarmers([row]);
  };

  const inputColumns = useMemo(() => {
    const set = new Set();
    for (const row of rows) {
      for (const col of Object.keys(row.inputByType)) set.add(col);
    }
    return Array.from(set);
  }, [rows]);

  const deductionColumns = useMemo(() => {
    const set = new Set();
    for (const row of rows) {
      for (const col of Object.keys(row.deductionByName || {})) set.add(col);
    }
    return Array.from(set);
  }, [rows]);

  const totals = useMemo(() => {
    const out = { mass: 0, sales: 0, usdBaki: 0, grossTzs: 0, malipoHalisi: 0, byType: {}, deductionByName: {} };
    for (const row of rows) {
      out.mass += row.mass;
      out.sales += row.sales;
      out.usdBaki += row.usdBaki;
      out.grossTzs += row.grossTzs;
      out.malipoHalisi += row.malipoHalisi;
      for (const col of inputColumns) {
        out.byType[col] = (out.byType[col] || 0) + (row.inputByType[col] || 0);
      }
      for (const col of deductionColumns) {
        out.deductionByName[col] = (out.deductionByName[col] || 0) + (row.deductionByName[col] || 0);
      }
    }
    return out;
  }, [rows, inputColumns, deductionColumns]);

  const currentDeductionRows = deductions.byPs?.[deductionPs] || [];

  const selectedSeasonLabel = useMemo(() => {
    const seasonMatch = seasons.find(s => s.id === selectedSeason || s.name === selectedSeason);
    return seasonMatch?.name || selectedSeason || '-';
  }, [seasons, selectedSeason]);

  const currentDisplayedPS = isSupervisor ? psFilter : scopedPS;
  const currentDisplayedPSName = getPsName(currentDisplayedPS);
  const isSinglePS = currentDisplayedPS && currentDisplayedPS !== 'All';

  const formatUsd = (value) => `$${parseFloat(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatUsdDeduction = (value) => `-$${parseFloat(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatTzs = (value) => parseFloat(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const formatTzsDeduction = (value) => `-${formatTzs(value)}`;

  const exportCSV = () => {
    const headers = [
      'Farmer #', 'Name', ...(isSinglePS ? [] : ['Society']), 'Mass (kg)', 'Sales (USD)', 
      ...inputColumns.map(c => `${c} (USD)`), 
      'USD Baki', 'Gross TZS', 
      ...deductionColumns, 
      'NET TZS', 'Paid to Date (TZS)', 'Remaining (TZS)'
    ];

    const body = rows.map(row => {
      const previouslyPaid = parseFloat(farmerPaidTotals[row.farmer.id] || 0);
      const remaining = parseFloat(row.malipoHalisi || 0) - previouslyPaid;

      return [
        row.farmer.farmerNumber || '',
        `${row.farmer.firstName || ''} ${row.farmer.lastName || ''}`.trim(),
        ...(isSinglePS ? [] : [getPsName(row.farmer.ps) || '']),
        row.mass.toFixed(2),
        formatUsd(row.sales),
        ...inputColumns.map(c => formatUsdDeduction(row.inputByType[c] || 0)),
        formatUsd(row.usdBaki),
        formatTzs(row.grossTzs),
        ...deductionColumns.map(c => formatTzsDeduction(row.deductionByName[c] || 0)),
        formatTzs(row.malipoHalisi),
        formatTzs(previouslyPaid),
        formatTzs(remaining)
      ];
    });

    body.push([
      'TOTAL', '', ...(isSinglePS ? [] : ['']),
      totals.mass.toFixed(2),
      formatUsd(totals.sales),
      ...inputColumns.map(c => formatUsdDeduction(totals.byType[c] || 0)),
      formatUsd(totals.usdBaki),
      formatTzs(totals.grossTzs),
      ...deductionColumns.map(c => formatTzsDeduction(totals.deductionByName[c] || 0)),
      formatTzs(totals.malipoHalisi),
      formatTzs(totalPaidToDateInView),
      formatTzs(totalRemainingInView)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,'
      + [headers, ...body].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `Payment_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportExcel = () => {
    const headers = [
      'Farmer #', 'Name', ...(isSinglePS ? [] : ['Society']), 'Mass (kg)', 'Sales (USD)', 
      ...inputColumns.map(c => `${c} (USD)`), 
      'USD Baki', 'Gross TZS', 
      ...deductionColumns, 
      'NET TZS', 'Paid to Date (TZS)', 'Remaining (TZS)'
    ];

    const body = rows.map(row => {
      const previouslyPaid = parseFloat(farmerPaidTotals[row.farmer.id] || 0);
      const remaining = parseFloat(row.malipoHalisi || 0) - previouslyPaid;

      return [
        row.farmer.farmerNumber || '',
        `${row.farmer.firstName || ''} ${row.farmer.lastName || ''}`.trim(),
        ...(isSinglePS ? [] : [getPsName(row.farmer.ps) || '']),
        row.mass.toFixed(2),
        formatUsd(row.sales),
        ...inputColumns.map(c => formatUsdDeduction(row.inputByType[c] || 0)),
        formatUsd(row.usdBaki),
        formatTzs(row.grossTzs),
        ...deductionColumns.map(c => formatTzsDeduction(row.deductionByName[c] || 0)),
        formatTzs(row.malipoHalisi),
        formatTzs(previouslyPaid),
        formatTzs(remaining)
      ];
    });

    body.push([
      'TOTAL', '', ...(isSinglePS ? [] : ['']),
      totals.mass.toFixed(2),
      formatUsd(totals.sales),
      ...inputColumns.map(c => formatUsdDeduction(totals.byType[c] || 0)),
      formatUsd(totals.usdBaki),
      formatTzs(totals.grossTzs),
      ...deductionColumns.map(c => formatTzsDeduction(totals.deductionByName[c] || 0)),
      formatTzs(totals.malipoHalisi),
      formatTzs(totalPaidToDateInView),
      formatTzs(totalRemainingInView)
    ]);

    let tableHTML = `<table><tr><td colspan="${headers.length}" style="font-size: 20px; font-weight: bold; text-align: center;">${isSinglePS ? `${currentDisplayedPSName} Payment Report - Season ${selectedSeasonLabel}` : `Tobacco Sales - Payments Report - Season ${selectedSeasonLabel}`}</td></tr></table>`;
    tableHTML += `<table border="1"><thead><tr>`;
    headers.forEach(h => { tableHTML += `<th style="background-color: #047857; color: white;">${h}</th>`; });
    tableHTML += `</tr></thead><tbody>`;

    body.forEach(row => {
      tableHTML += `<tr>`;
      row.forEach(cell => { tableHTML += `<td>${String(cell)}</td>`; });
      tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table>`;

    const excelData = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"></head>
      <body>${tableHTML}</body>
      </html>
    `;

    const blob = new Blob([excelData], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payment_Summary_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="payment-print-hide flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-2xl font-bold">Payment Summary</h3>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>USD sales → deductions → TZS conversion</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className={`px-3 py-2 border rounded-lg min-w-[200px] ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
          >
            {seasons.map(s => <option key={s.id} value={s.id || s.name}>{s.name || s.id}</option>)}
          </select>
          {isSupervisor && (
            <select
              value={psFilter}
              onChange={(e) => setPsFilter(e.target.value)}
              className={`px-3 py-2 border rounded-lg min-w-[200px] ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
            >
              <option value="All">All PS</option>
              {availablePsFilters.map(ps => <option key={ps} value={ps}>{getPsName(ps)}</option>)}
            </select>
          )}
          <button onClick={exportExcel} className="px-3 py-2 border rounded-lg flex items-center gap-2 text-green-600 border-green-400">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportCSV} className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={handlePrintPayment} className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <div className="payment-print-area">
      <div className="payment-print-hide grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-4`}>
          <h4 className="font-semibold mb-2">Exchange Rate (USD → TZS) per PS</h4>
          <label className="text-sm block mb-1">Select PS</label>
          <select
            value={ratePs}
            onChange={(e) => setRatePs(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg mb-3 ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
          >
            <option value="">Choose a Primary Society...</option>
            {[...new Set(farmers.map(f => f.ps).filter(Boolean))].map(ps => <option key={ps} value={ps}>{getPsName(ps)}</option>)}
          </select>

          {ratePs && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm block mb-1">Rate (TZS)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateValue}
                  onChange={(e) => setRateValue(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                />
              </div>
              {isSupervisor && (
                <button
                  onClick={saveRateForPs}
                  disabled={savingRate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> {savingRate ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-4`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">TZS Deductions per PS</h4>
            {isSupervisor && (
              <button onClick={() => setShowDeductionForm(v => !v)} className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                <Plus className="w-4 h-4" /> Add
              </button>
            )}
          </div>
          <label className="text-sm block mb-1">Filter by PS</label>
          <select
            value={deductionPs}
            onChange={(e) => setDeductionPs(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg mb-3 ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
          >
            <option value="">Choose PS...</option>
            {[...new Set(farmers.map(f => f.ps).filter(Boolean))].map(ps => <option key={ps} value={ps}>{getPsName(ps)}</option>)}
          </select>

          {showDeductionForm && isSupervisor && (
            <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-3 mb-3`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="text-sm block mb-1">Name</label>
                  <input
                    type="text"
                    value={deductionForm.name}
                    onChange={(e) => setDeductionForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Levy, Contribution"
                    className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-800 border-gray-600' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="text-sm block mb-1">Amount (TZS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={deductionForm.amount}
                    onChange={(e) => setDeductionForm(prev => ({ ...prev, amount: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-800 border-gray-600' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="text-sm block mb-1">Type</label>
                  <select
                    value={deductionForm.type}
                    onChange={(e) => setDeductionForm(prev => ({ ...prev, type: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-800 border-gray-600' : 'border-gray-300'}`}
                  >
                    <option value="Per Farmer">Per Farmer</option>
                    <option value="Per Kg">Per Kg</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={addDeduction}
                  disabled={savingDeduction}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {savingDeduction ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowDeductionForm(false); setDeductionForm({ name: '', amount: '', type: 'Per Farmer' }); }}
                  className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {currentDeductionRows.length === 0 ? (
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm text-center py-4`}>No TZS deductions for this PS</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-auto">
              {currentDeductionRows.map(row => (
                <div key={row.id} className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg px-3 py-2 flex justify-between text-sm`}>
                  <span>{row.name}</span>
                  <span>{parseFloat(row.amount || 0).toLocaleString()} TZS ({row.type})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {globalRate > 0 && (
        <div className={`payment-print-hide ${darkMode ? 'bg-blue-900/20 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-300 text-blue-700'} border rounded-lg p-3 mb-4`}>
          ℹ Using global fallback exchange rate: <strong>{globalRate.toLocaleString()} TZS</strong> for farmers without a PS-specific rate.
        </div>
      )}

      <div className="payment-print-hide grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-4`}>
          <p className="text-xs uppercase tracking-wide text-gray-500">Sales (USD)</p>
          <p className="text-3xl font-bold text-blue-600">{formatUsd(totals.sales)}</p>
        </div>
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-4`}>
          <p className="text-xs uppercase tracking-wide text-gray-500">Inputs (USD)</p>
          <p className="text-3xl font-bold text-orange-600">{formatUsdDeduction(Object.values(totals.byType).reduce((s, v) => s + v, 0))}</p>
        </div>
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-4`}>
          <p className="text-xs uppercase tracking-wide text-gray-500">USD Baki</p>
          <p className={`text-3xl font-bold ${totals.usdBaki < 0 ? 'text-blue-500' : 'text-green-600'}`}>{formatUsd(totals.usdBaki)}</p>
        </div>
        <div className="rounded-xl border p-4 bg-emerald-700 border-emerald-700 text-white">
          <p className="text-xs uppercase tracking-wide text-emerald-100">Malipo Halisi (TZS)</p>
          <p className="text-3xl font-bold">{formatTzs(totals.malipoHalisi)}</p>
        </div>
      </div>

      {!exchangeRates.byPs?.[ratePs] && !globalRate && (
        <div className={`payment-print-hide ${darkMode ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300' : 'bg-yellow-50 border-yellow-300 text-yellow-700'} border rounded-lg p-3 mb-4`}>
          ⚠ No exchange rate set. Enter and save a rate above to see TZS calculations.
        </div>
      )}

      <div className="payment-print-hide mb-3 max-w-md relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search farmers, society..."
          className={`w-full pl-9 pr-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-800 border-gray-700' : 'border-gray-300'}`}
        />
      </div>

      {isSupervisor && (
        <div className="payment-print-hide mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Selected Farmers: <strong>{selectedFarmerIds.length}</strong> · Paid in View: <strong>{paidInViewCount}</strong>
          </p>
          <button
            onClick={paySelectedFarmers}
            disabled={savingPayments || selectedFarmerIds.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {savingPayments ? 'Processing...' : `Pay Selected & Print (${selectedFarmerIds.length})`}
          </button>
        </div>
      )}

      <div className="payment-print-only payment-print-title hidden mb-4 text-black">
        <h2 className="text-xl font-bold">{isSinglePS ? `${currentDisplayedPSName} Payment Report` : 'Tobacco Sales - Payments Report'}</h2>
        <p className="text-sm mt-1">Season: {selectedSeasonLabel}</p>
      </div>

      <div className={`payment-print-table-wrap ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl overflow-x-auto`}>
        <table className="payment-print-table w-full text-xs min-w-[1100px]">
          <thead>
            <tr>
              {isSupervisor && (
                <th className="px-3 py-2 text-center bg-emerald-700 text-white font-semibold payment-print-hide">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                </th>
              )}
              <th className="px-3 py-2 text-left bg-emerald-700 text-white font-semibold">Farmer #</th>
              <th className="px-3 py-2 text-left bg-emerald-700 text-white font-semibold">Name</th>
              {!isSinglePS && <th className="px-3 py-2 text-left bg-emerald-700 text-white font-semibold">Society</th>}
              <th className="px-3 py-2 text-right bg-emerald-700 text-white font-semibold">Mass (kg)</th>
              <th className="px-3 py-2 text-right bg-emerald-700 text-white font-semibold">Sales (USD)</th>
              {inputColumns.map(col => (
                <th key={col} className="px-3 py-2 text-right bg-amber-700 text-white font-semibold">{col} (USD)</th>
              ))}
              <th className="px-3 py-2 text-right bg-emerald-600 text-white font-semibold">USD Baki</th>
              <th className="px-3 py-2 text-right bg-violet-700 text-white font-semibold">Gross TZS</th>
              {deductionColumns.map(col => (
                <th key={col} className="px-3 py-2 text-right bg-violet-700 text-white font-semibold">{col}</th>
              ))}
              <th className="px-3 py-2 text-right bg-emerald-950 text-white font-semibold">NET TZS</th>
              <th className="px-3 py-2 text-right bg-emerald-900 text-white font-semibold">Paid to Date (TZS)</th>
              <th className="px-3 py-2 text-right bg-emerald-900 text-white font-semibold">Remaining (TZS)</th>
              {isSupervisor && <th className="px-3 py-2 text-right bg-emerald-950 text-white font-semibold payment-print-hide">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => (
              <tr key={row.farmer.id} className={darkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                {isSupervisor && (
                  <td className="px-3 py-2 text-center payment-print-hide">
                    <input
                      type="checkbox"
                      checked={selectedFarmerIds.includes(row.farmer.id)}
                      onChange={() => toggleRowSelection(row.farmer.id)}
                    />
                  </td>
                )}
                <td className="px-3 py-2">{row.farmer.farmerNumber || '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>{`${row.farmer.firstName || ''} ${row.farmer.lastName || ''}`.trim()}</span>
                    {paidFarmerIds.has(row.farmer.id) && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-600 text-white shadow-sm">
                        PAID
                      </span>
                    )}
                  </div>
                </td>
                {!isSinglePS && <td className="px-3 py-2">{getPsName(row.farmer.ps)}</td>}
                <td className="px-3 py-2 text-right">{row.mass.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{formatUsd(row.sales)}</td>
                {inputColumns.map(col => (
                  <td key={`${row.farmer.id}-${col}`} className="px-3 py-2 text-right text-orange-700">
                    {formatUsdDeduction(row.inputByType[col] || 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-medium">{formatUsd(row.usdBaki)}</td>
                <td className="px-3 py-2 text-right">{formatTzs(row.grossTzs)}</td>
                {deductionColumns.map(col => (
                  <td key={`${row.farmer.id}-${col}-tzs`} className="px-3 py-2 text-right text-purple-700">
                    {formatTzsDeduction(row.deductionByName[col] || 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold">{formatTzs(row.malipoHalisi)}</td>
                <td className="px-3 py-2 text-right">{formatTzs(farmerPaidTotals[row.farmer.id] || 0)}</td>
                <td className={`px-3 py-2 text-right font-medium ${(parseFloat(row.malipoHalisi || 0) - parseFloat(farmerPaidTotals[row.farmer.id] || 0)) > PAYMENT_EPSILON ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {formatTzs(parseFloat(row.malipoHalisi || 0) - parseFloat(farmerPaidTotals[row.farmer.id] || 0))}
                </td>
                {isSupervisor && (
                  <td className="px-3 py-2 text-right payment-print-hide">
                    <button
                      onClick={() => paySingleFarmer(row)}
                      disabled={savingPayments}
                      className={`px-3 py-1.5 rounded-lg text-white ${paidFarmerIds.has(row.farmer.id) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-50`}
                    >
                      {paidFarmerIds.has(row.farmer.id) ? 'Pay Again' : 'Pay'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            <tr className="bg-slate-900 text-white font-bold">
              <td className="px-3 py-2" colSpan={isSupervisor ? 4 : 3}>TOTAL</td>
              <td className="px-3 py-2 text-right">{totals.mass.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{formatUsd(totals.sales)}</td>
              {inputColumns.map(col => (
                <td key={`total-${col}`} className="px-3 py-2 text-right">{formatUsdDeduction(totals.byType[col] || 0)}</td>
              ))}
              <td className="px-3 py-2 text-right">{formatUsd(totals.usdBaki)}</td>
              <td className="px-3 py-2 text-right">{formatTzs(totals.grossTzs)}</td>
              {deductionColumns.map(col => (
                <td key={`total-ded-${col}`} className="px-3 py-2 text-right">{formatTzsDeduction(totals.deductionByName[col] || 0)}</td>
              ))}
              <td className="px-3 py-2 text-right">{formatTzs(totals.malipoHalisi)}</td>
              <td className="px-3 py-2 text-right">{formatTzs(totalPaidToDateInView)}</td>
              <td className="px-3 py-2 text-right">{formatTzs(totalRemainingInView)}</td>
              {isSupervisor && <td className="px-3 py-2 payment-print-hide"></td>}
            </tr>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-gray-500" colSpan={(isSupervisor ? 12 : 10) + inputColumns.length + deductionColumns.length}>No farmer rows to display</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {lastPaidRows.length > 0 && (
        <div className="payment-print-only farmer-payment-print-only hidden mt-6 text-black">
          <h2 className="text-xl font-bold">Farmer Payment Receipt</h2>
          <p className="text-sm mt-1">Season: {selectedSeasonLabel}</p>
          <p className="text-sm mt-1">Generated: {new Date(lastPaidAt).toLocaleString()}</p>

          <table className="w-full text-xs mt-4 border border-black">
            <thead>
              <tr>
                <th className="border border-black px-2 py-1 text-left">Farmer #</th>
                <th className="border border-black px-2 py-1 text-left">Farmer Name</th>
                <th className="border border-black px-2 py-1 text-left">PS</th>
                <th className="border border-black px-2 py-1 text-right">USD Baki</th>
                <th className="border border-black px-2 py-1 text-right">Net Payment (TZS)</th>
              </tr>
            </thead>
            <tbody>
              {lastPaidRows.map((row) => (
                <tr key={`receipt-${row.farmer.id}`}>
                  <td className="border border-black px-2 py-1">{row.farmer.farmerNumber || '-'}</td>
                  <td className="border border-black px-2 py-1">{`${row.farmer.firstName || ''} ${row.farmer.lastName || ''}`.trim()}</td>
                  <td className="border border-black px-2 py-1">{row.farmer.ps || '-'}</td>
                  <td className="border border-black px-2 py-1 text-right">{formatUsd(row.usdBaki)}</td>
                  <td className="border border-black px-2 py-1 text-right">{formatTzs(row.amountPaidNow ?? row.malipoHalisi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="payment-print-only payment-print-signatures hidden mt-10 text-black">
        <div className="grid grid-cols-2 gap-10">
          <div>
            <p className="text-sm mb-10">Prepared By:</p>
            <div className="border-t border-black pt-1 text-sm">Name & Signature</div>
          </div>
          <div>
            <p className="text-sm mb-10">Approved By:</p>
            <div className="border-t border-black pt-1 text-sm">Name & Signature</div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default PaymentModule;
