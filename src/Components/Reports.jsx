import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useStorage } from '../hooks/useStorage';
import { Download, FileSpreadsheet, Users, Leaf, Banknote, Tag, Printer, ChevronDown, ChevronRight, Star } from 'lucide-react';
import { filterItemsByPS, getScopedPS } from '../utils';

function Reports() {
  const { darkMode, currentUser, activePS, activeTabOverride, setActiveTabOverride } = useAppContext();
  
  const { items: farmers } = useStorage('farmer');
  const { items: seasons } = useStorage('season');
  const { items: inputs } = useStorage('issuedinput');
  const { items: inputTypes } = useStorage('inputtype');
  const { items: tickets } = useStorage('ticket');
  const { items: payments } = useStorage('payment');
  const { items: grades } = useStorage('grade');
  const { items: primarySocieties } = useStorage('ps');

  const getColumnAlignment = (header) => {
    const lower = String(header).toLowerCase();
    if (lower.includes('usd') || lower.includes('tzs') || lower.includes('mass') || lower.includes('bales') || lower.includes('weight') || lower.includes('price') || lower.includes('amount') || lower.includes('rate') || lower.includes('quantity')) {
      return 'text-right';
    }
    return 'text-left';
  };

  const getCellColor = (val, header) => {
    const str = String(val || '').trim();
    if (str === '-') return 'text-gray-400 font-light';
    if (str.startsWith('-$') || (str.startsWith('-') && /[0-9]/.test(str))) return 'text-red-600 dark:text-red-400 font-bold';
    
    const lowerHeader = String(header).toLowerCase();
    if (lowerHeader.includes('net tzs') || lowerHeader.includes('remaining') || lowerHeader.includes('paid to date')) {
       return 'text-emerald-600 dark:text-emerald-400 font-black tracking-wide bg-emerald-50 dark:bg-emerald-900/10';
    }
    if (str.startsWith('$')) return 'text-emerald-600 dark:text-emerald-400 font-semibold';
    if (str.includes('%')) return 'text-blue-600 dark:text-blue-400 font-bold';
    if (lowerHeader.includes('farmer #') || lowerHeader.includes('sale number') || lowerHeader.includes('grade code')) {
       return 'text-indigo-600 dark:text-indigo-400 font-bold';
    }
    return 'text-gray-800 dark:text-gray-200';
  };

  const [exchangeRates, setExchangeRates] = useState({ byPs: {} });
  const [deductions, setDeductions] = useState({ byPs: {} });
  const [globalRate, setGlobalRate] = useState(0);

  useEffect(() => {
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
        console.error('Failed to load configs:', e);
      }
    };
    loadConfigs();
  }, []);

  const getPsName = (code) => {
    if (!code || code === 'All') return code;
    const match = primarySocieties.find(p => p.code === code);
    return match ? match.name : code;
  };

  const [reportType, setReportType] = useState(activeTabOverride || 'sales'); 
  const [seasonFilter, setSeasonFilter] = useState('');
  const [showSalesMenu, setShowSalesMenu] = useState(false);
  const [selectedSales, setSelectedSales] = useState([]);
  const [expandedSales, setExpandedSales] = useState({});
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  const isSupervisor = currentUser.role === 'Supervisor' || currentUser.role === 'Admin';
  const activePSValue = getScopedPS(currentUser, activePS);
  const currentDisplayedPSName = getPsName(activePSValue);
  const isSinglePS = activePSValue && activePSValue !== 'All';

  const scopedFarmers = useMemo(() => filterItemsByPS(farmers, activePSValue), [farmers, activePSValue]);
  const scopedInputs = useMemo(() => filterItemsByPS(inputs, activePSValue), [inputs, activePSValue]);
  const scopedTickets = useMemo(() => filterItemsByPS(tickets, activePSValue), [tickets, activePSValue]);
  const scopedPayments = useMemo(() => filterItemsByPS(payments, activePSValue), [payments, activePSValue]);

  const farmerPaidTotals = useMemo(() => {
    const totals = {};
    for (const payment of payments) {
      if (payment?.farmerId) {
        totals[payment.farmerId] = (totals[payment.farmerId] || 0) + parseFloat(payment.netPayment || 0);
      }
    }
    return totals;
  }, [payments]);

  useEffect(() => {
    if (activeTabOverride) {
      setReportType(activeTabOverride);
      setActiveTabOverride(null);
    }
  }, [activeTabOverride, setActiveTabOverride]);

  useEffect(() => {
    const clearPrintMode = () => {
      document.body.classList.remove('printing-report-only');
    };

    window.addEventListener('afterprint', clearPrintMode);
    return () => {
      clearPrintMode();
      window.removeEventListener('afterprint', clearPrintMode);
    };
  }, []);

  const handlePrintReport = () => {
    document.body.classList.add('printing-report-only');
    window.print();
  };
  
  const toggleSale = (sale) => {
    setSelectedSales(prev => prev.includes(sale) ? prev.filter(s => s !== sale) : [...prev, sale]);
  };

  const toggleSaleExpansion = (sale) => {
    setExpandedSales(prev => ({ ...prev, [sale]: !prev[sale] }));
  };

  const availableSales = useMemo(() => {
    return Array.from(
      new Set(
        scopedTickets
          .map(t => t.saleNumber)
          .filter(Boolean)
      )
    );
  }, [scopedTickets]);

  useEffect(() => {
    if (selectedSales.length !== 1) {
      return;
    }

    setExpandedSales((previous) => {
      const nextExpanded = {};
      Object.keys(previous).forEach((key) => {
        if (key.endsWith(`::${selectedSales[0]}`)) {
          nextExpanded[key] = true;
        }
      });
      return nextExpanded;
    });
  }, [selectedSales]);
  
  const getFarmerName = (id) => {
    const f = scopedFarmers.find(f => f.id === id) || farmers.find(f => f.id === id);
    return f ? `${f.farmerNumber} - ${f.firstName} ${f.lastName}` : 'Unknown';
  };

  const getInputTypeName = (id) => {
    const i = inputTypes.find(type => type.id === id);
    return i ? i.name : 'Unknown';
  };

  const formatUsd = (value) => `$${parseFloat(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatTzs = (value) => parseFloat(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const exportToCSV = (filename, dataRows) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + dataRows.map(row => row.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = (filename, headers, rows) => {
    let tableHTML = `<table border="1"><thead><tr>`;
    headers.forEach(h => { tableHTML += `<th style="background-color: #2563eb; color: white;">${h}</th>`; });
    tableHTML += `</tr></thead><tbody>`;

    rows.forEach(row => {
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
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderFarmersReport = () => {
    let data = [...scopedFarmers];
    if (seasonFilter) data = data.filter(f => f.seasonId === seasonFilter || f.season === seasonFilter);
    const formatVolumeKg = (value) => `${Math.round(parseFloat(value || 0))} kgs`;
    const headers = ['Farmer #', 'Full Name', 'Gender', 'Village', 'Phone', 'Hectares', 'Vol(Kg)', 'Season', ...(isSinglePS ? [] : ['PS'])];
    return {
      headers,
      rows: data.map(f => [
        f.farmerNumber, `${f.firstName} ${f.lastName}`, f.gender || '-', f.village, f.phoneNumber || '-', 
        f.hectares || '0', formatVolumeKg(f.contractedVolume), f.seasonName || f.season || '-', ...(isSinglePS ? [] : [getPsName(f.ps) || ''])
      ]),
      title: isSinglePS ? `${currentDisplayedPSName} Farmer Registration List` : 'Farmer Registration List'
    };
  };

  const renderInputsReport = () => {
    let data = [...scopedInputs];
    const headers = ['Issue Date', 'Farmer', 'Input Item', 'Quantity', 'Total Value', ...(isSinglePS ? [] : ['PS'])];
    return {
      headers,
      rows: data.map(i => {
        const typeObj = inputTypes.find(t => t.id === i.inputTypeId);
        const name = i.inputName || typeObj?.name || 'Unknown';
        const isAdvance = i.isCashAdvance || name.toLowerCase().includes('advance') || typeObj?.category === 'Cash Advance';
        
        return [
          new Date(i.issueDate || i.createdAt).toLocaleDateString(),
          getFarmerName(i.farmerId),
          name,
          isAdvance ? '-' : i.quantity,
          isAdvance ? formatTzs(i.totalCost || i.totalValue || 0) + ' TZS' : formatUsd(i.totalCost || i.totalValue || 0),
          ...(isSinglePS ? [] : [getPsName(i.ps) || ''])
        ];
      }),
      title: isSinglePS ? `${currentDisplayedPSName} Agricultural Inputs Report` : 'Agricultural Inputs Report'
    };
  };

  const renderGradesReport = () => {
    let data = [...scopedTickets];
    const gradeStats = data.reduce((acc, t) => {
      const code = t.grade_code || t.gCode || 'Unknown';
      if (!acc[code]) {
        acc[code] = { 
           code, name: t.gradeName || 'Unknown', category: t.gradeCategory || 'Other',
           level: t.gradeLevel || 'Reject', bales: 0, weight: 0, value: 0 
        };
      }
      acc[code].bales += 1;
      acc[code].weight += parseFloat(t.netWeight || t.mass || 0);
      acc[code].value += parseFloat(t.totalValue || t.value || 0);
      return acc;
    }, {});
    let result = Object.values(gradeStats);
    if (categoryFilter) result = result.filter(g => g.category === categoryFilter);
    if (levelFilter) result = result.filter(g => g.level === levelFilter);
    const headers = ['Grade Code', 'Name', 'Category', 'Level', 'Bales', 'Weight (Kg)', 'Value (USD)'];
    return {
      headers,
      rows: result.map(g => [g.code, g.name, g.category, g.level, g.bales.toString(), g.weight.toFixed(2), formatUsd(g.value)]),
      title: isSinglePS ? `${currentDisplayedPSName} Grade Distribution Report` : 'Grade Distribution Report'
    };
  };

  const renderPremiumReport = () => {
    const data = scopedTickets;
    const farmerStats = data.reduce((acc, t) => {
      const fId = t.farmerId;
      if (!acc[fId]) {
        acc[fId] = { name: getFarmerName(fId), totalBales: 0, premiumBales: 0, totalWeight: 0, premiumWeight: 0 };
      }
      acc[fId].totalBales += 1;
      acc[fId].totalWeight += parseFloat(t.netWeight || t.mass || 0);
      if (t.grade_code && t.grade_code.endsWith('OF')) {
        acc[fId].premiumBales += 1;
        acc[fId].premiumWeight += parseFloat(t.netWeight || t.mass || 0);
      }
      return acc;
    }, {});

    const headers = ['Farmer', 'Total Bales', 'Premium Bales', 'Premium %', 'Total Weight (Kg)', 'Premium Weight (Kg)'];
    const rows = Object.values(farmerStats).map(f => [
      f.name, f.totalBales.toString(), f.premiumBales.toString(),
      f.totalBales > 0 ? (f.premiumBales / f.totalBales * 100).toFixed(1) + '%' : '0%',
      f.totalWeight.toFixed(2), f.premiumWeight.toFixed(2)
    ]);
    return { headers, rows, title: isSinglePS ? `${currentDisplayedPSName} Premium Leaf Production Ratio` : 'Premium Leaf Production Ratio' };
  };

  const renderPremiumSummary = () => {
    const isQuality = (t) => {
      const g = grades.find(gr => gr.grade_code === t.grade_code);
      return g ? g.is_quality_grade === 1 : true;
    };

    const qTicks = scopedTickets.filter(t => isQuality(t));
    const pTicks = qTicks.filter(t => t.grade_code && t.grade_code.endsWith('OF'));
    const sTicks = qTicks.filter(t => t.grade_code && t.grade_code.includes('O') && !t.grade_code.endsWith('OF'));
    const rTicks = qTicks.filter(t => t.grade_code === 'REJ' || t.quality_level === 'Reject');
    
    const canTicks = scopedTickets.filter(t => t.grade_code === 'CAN');
    const witTicks = scopedTickets.filter(t => t.grade_code === 'WIT');

    const pStat = { count: pTicks.length, weight: pTicks.reduce((s,t) => s + parseFloat(t.netWeight || t.mass || 0), 0) };
    const sStat = { count: sTicks.length, weight: sTicks.reduce((s,t) => s + parseFloat(t.netWeight || t.mass || 0), 0) };
    const rStat = { count: rTicks.length, weight: rTicks.reduce((s,t) => s + parseFloat(t.netWeight || t.mass || 0), 0) };

    const pRatio = pStat.count + sStat.count > 0 ? (pStat.count / (pStat.count + sStat.count) * 100).toFixed(1) : 0;
    const rRate = qTicks.length > 0 ? (rStat.count / qTicks.length * 100).toFixed(1) : 0;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-amber-600 border border-amber-500 rounded-2xl shadow-sm">
            <p className="text-[10px] font-black text-amber-100 uppercase tracking-widest mb-1">Premium L-OF</p>
            <p className="text-2xl font-black text-white">{pStat.count} Bales / {pStat.weight.toFixed(1)}kg</p>
          </div>
          <div className="p-4 bg-gray-600 border border-gray-500 rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-gray-200 uppercase tracking-widest mb-1">Standard L-O</p>
            <p className="text-2xl font-black text-white">{sStat.count} Bales / {sStat.weight.toFixed(1)}kg</p>
          </div>
          <div className="p-4 bg-rose-600 border border-rose-500 rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest mb-1">Reject (REJ)</p>
            <p className="text-2xl font-black text-white">{rStat.count} Bales ({rRate}%)</p>
          </div>
          <div className="p-4 bg-green-600 border border-green-500 rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-green-100 uppercase tracking-widest mb-1">Production Ratio</p>
            <p className="text-2xl font-black text-white">{pRatio}% Premium</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-orange-600 border border-orange-500 rounded-xl flex justify-between items-center">
            <span className="text-sm font-bold text-orange-100">Total Cancelled (CAN)</span>
            <span className="text-xl font-black text-white">{canTicks.length} Bales</span>
          </div>
          <div className="p-3 bg-orange-600 border border-orange-500 rounded-xl flex justify-between items-center">
            <span className="text-sm font-bold text-orange-100">Total Withdrawn (WIT)</span>
            <span className="text-xl font-black text-white">{witTicks.length} Bales</span>
          </div>
        </div>
      </div>
    );
  };

  const renderPaymentsReport = () => {
    const calculateDeductionAmount = (deduction, mass) => {
      const amount = parseFloat(deduction?.amount || 0);
      const type = String(deduction?.type || '').toLowerCase();
      if (type.includes('kg')) {
        return amount * mass;
      }
      return amount;
    };

    const rows = scopedFarmers.map((farmer) => {
      const farmerTickets = scopedTickets.filter(t => t.farmerId === farmer.id);
      const farmerInputs = scopedInputs.filter(i => i.farmerId === farmer.id);

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
      const previouslyPaid = parseFloat(farmerPaidTotals[farmer.id] || 0);
      const remainingBalance = malipoHalisi - previouslyPaid;

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
        malipoHalisi,
        previouslyPaid,
        remainingBalance
      };
    }).filter(row => row.mass > 0 || row.sales > 0 || Object.keys(row.inputByType).length > 0 || row.previouslyPaid > 0);

    const inputSet = new Set();
    const deductionSet = new Set();
    
    rows.forEach(r => {
      Object.keys(r.inputByType).forEach(k => inputSet.add(k));
      Object.keys(r.deductionByName).forEach(k => deductionSet.add(k));
    });

    const inputColumns = Array.from(inputSet).sort();
    const deductionColumns = Array.from(deductionSet).sort();

    const headers = [
      'Farmer #', 'Name', ...(isSinglePS ? [] : ['PS']),
      'Mass', 'Sales (USD)', 
      ...inputColumns.map(c => `${c} (USD)`),
      'USD Baki', 'Rate', 'Gross TZS',
      ...deductionColumns,
      'Net TZS', 'Paid to Date', 'Remaining'
    ];

    const formatUsdDeduction = (value) => `-$${parseFloat(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatTzsDeduction = (value) => `-${parseFloat(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    return {
      headers,
      rows: rows.map(r => [
        r.farmer.farmerNumber || '-',
        `${r.farmer.firstName} ${r.farmer.lastName}`,
        ...(isSinglePS ? [] : [getPsName(r.farmer.ps) || '']),
        r.mass.toFixed(2),
        formatUsd(r.sales),
        ...inputColumns.map(c => formatUsdDeduction(r.inputByType[c])),
        formatUsd(r.usdBaki),
        r.rate,
        formatTzs(r.grossTzs),
        ...deductionColumns.map(c => formatTzsDeduction(r.deductionByName[c])),
        formatTzs(r.malipoHalisi),
        formatTzs(r.previouslyPaid),
        formatTzs(r.remainingBalance)
      ]),
      title: isSinglePS ? `${currentDisplayedPSName} Outstanding Balances Report` : 'Outstanding Balances Report'
    };
  };

  const salesSummaryData = useMemo(() => {
    let data = [...scopedTickets];
    if (selectedSales.length > 0) {
      data = data.filter(ticket => selectedSales.includes(ticket.saleNumber));
    }

    const salesMap = {};

    data.forEach((ticket) => {
      const marketCenter = ticket.marketCenterName || ticket.marketCenter || '-';
      const saleNumber = ticket.saleNumber || '-';
      const rowKey = `${marketCenter}::${saleNumber}`;

      if (!salesMap[rowKey]) {
        salesMap[rowKey] = {
          rowKey,
          marketCenter,
          saleNumber,
          bales: 0,
          massPurchased: 0,
          valuePurchased: 0,
          tickets: [],
        };
      }

      salesMap[rowKey].bales += 1;
      salesMap[rowKey].massPurchased += parseFloat(ticket.netWeight || ticket.mass || 0);
      salesMap[rowKey].valuePurchased += parseFloat(ticket.totalValue || ticket.value || 0);
      salesMap[rowKey].tickets.push(ticket);
    });

    return Object.values(salesMap)
      .map((sale) => {
        const pcnMap = {};

        sale.tickets.forEach((ticket) => {
          const pcnNumber = ticket.pcnNumber || 'Unassigned';
          if (!pcnMap[pcnNumber]) {
            pcnMap[pcnNumber] = {
              pcnNumber,
              bales: 0,
              mass: 0,
              value: 0,
              farmers: new Set(),
            };
          }

          pcnMap[pcnNumber].bales += 1;
          pcnMap[pcnNumber].mass += parseFloat(ticket.netWeight || ticket.mass || 0);
          pcnMap[pcnNumber].value += parseFloat(ticket.totalValue || ticket.value || 0);
          if (ticket.farmerId) {
            pcnMap[pcnNumber].farmers.add(ticket.farmerId);
          }
        });

        const pcns = Object.values(pcnMap)
          .map((pcn) => ({
            ...pcn,
            farmers: pcn.farmers.size,
          }))
          .sort((left, right) => {
            if (left.pcnNumber === 'Unassigned') return 1;
            if (right.pcnNumber === 'Unassigned') return -1;
            return left.pcnNumber.localeCompare(right.pcnNumber, undefined, { numeric: true });
          });

        return {
          ...sale,
          averagePrice: sale.massPurchased > 0 ? sale.valuePurchased / sale.massPurchased : 0,
          pcns,
        };
      })
      .sort((left, right) => {
        if (left.marketCenter !== right.marketCenter) {
          return left.marketCenter.localeCompare(right.marketCenter);
        }
        return String(left.saleNumber).localeCompare(String(right.saleNumber), undefined, { numeric: true });
      });
  }, [scopedTickets, selectedSales]);

  let currentReport = { title: '', headers: [], rows: [] };
  if (reportType === 'farmers') currentReport = renderFarmersReport();
  else if (reportType === 'inputs') currentReport = renderInputsReport();
  else if (reportType === 'grades') currentReport = renderGradesReport();
  else if (reportType === 'premium') currentReport = renderPremiumReport();
  else if (reportType === 'payments' && isSupervisor) currentReport = renderPaymentsReport();

  const handleExport = (format) => {
    const isExcel = format === 'excel';
    if (reportType === 'sales') {
      const headers = ['Market Center', 'Sale Number', 'Bales', 'Mass Purchased', 'Value Purchased', 'Average Price'];
      const rows = salesSummaryData.map((sale) => [
        sale.marketCenter,
        sale.saleNumber,
        sale.bales,
        sale.massPurchased.toFixed(2),
        formatUsd(sale.valuePurchased),
        formatUsd(sale.averagePrice),
      ]);
      const filename = isSinglePS ? `${currentDisplayedPSName}_Tobacco_Sales_Summary` : 'Tobacco_Sales_Summary';
      if (isExcel) {
        exportToExcel(filename, headers, rows);
      } else {
        exportToCSV(filename, [headers, ...rows]);
      }
    } else {
      const filename = currentReport.title.replace(/ /g, '_');
      if (isExcel) {
        exportToExcel(filename, currentReport.headers, currentReport.rows);
      } else {
        exportToCSV(filename, [currentReport.headers, ...currentReport.rows]);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold">System Reports</h2>
        <div className="flex flex-wrap space-x-2 sm:space-x-3">
          <button onClick={handlePrintReport} className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"><Printer className="w-5 h-5" /></button>
          <button onClick={() => handleExport('excel')} className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white rounded-lg font-medium shadow-sm"><Download className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span></button>
          <button onClick={() => handleExport('csv')} className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-lg font-medium shadow-sm"><Download className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span></button>
        </div>
      </div>

      <div className={`report-print-area overflow-hidden rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <h3 className="font-bold flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <span>{reportType === 'sales' ? (isSinglePS ? `${currentDisplayedPSName} Tobacco Sales Summary` : 'Tobacco Sales Summary') : currentReport.title}</span>
          </h3>
          <div className="flex items-center gap-3 print:hidden">
            {reportType === 'sales' && (
              <div className="relative">
                <button
                  onClick={() => setShowSalesMenu(v => !v)}
                  className="px-3 py-1.5 text-xs border rounded-lg dark:bg-gray-700"
                >
                  {selectedSales.length > 0 ? `${selectedSales.length} sale(s) selected` : 'All Sales'}
                </button>
                {showSalesMenu && (
                  <div className="absolute right-0 mt-1 w-56 max-h-64 overflow-auto rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg z-20 p-2">
                    {availableSales.length === 0 ? (
                      <p className="text-xs text-gray-500 px-1 py-2">No sales available</p>
                    ) : (
                      availableSales.map(sale => (
                        <label key={sale} className="flex items-center gap-2 px-1 py-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSales.includes(sale)}
                            onChange={() => toggleSale(sale)}
                          />
                          <span>{sale}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {reportType === 'premium' && renderPremiumSummary()}
            {reportType === 'grades' && (
              <div className="flex gap-2">
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="p-1.5 text-xs border rounded-lg dark:bg-gray-700">
                  <option value="">All Categories</option>
                  <option value="LUGS">LUGS</option><option value="CUTTERS">CUTTERS</option><option value="THIN_LEAF">THIN LEAF</option><option value="LEAF">LEAF</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          {reportType === 'sales' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="p-3 w-12"></th>
                  <th className="p-3 text-left font-bold uppercase text-[10px]">Market Center</th>
                  <th className="p-3 text-left font-bold uppercase text-[10px]">Sale Number</th>
                  <th className="p-3 text-right font-bold uppercase text-[10px]">Bales</th>
                  <th className="p-3 text-right font-bold uppercase text-[10px]">Mass Purchased</th>
                  <th className="p-3 text-right font-bold uppercase text-[10px]">Value Purchased</th>
                  <th className="p-3 text-right font-bold uppercase text-[10px]">Average Price</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {salesSummaryData.map((sale) => (
                  <React.Fragment key={sale.rowKey}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleSaleExpansion(sale.rowKey)}
                          className={`rounded-md p-1 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                          aria-label={`Toggle details for sale ${sale.saleNumber}`}
                        >
                          {expandedSales[sale.rowKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="p-3 whitespace-nowrap font-medium">{sale.marketCenter}</td>
                      <td className="p-3 whitespace-nowrap font-semibold text-green-600 dark:text-green-400">{sale.saleNumber}</td>
                      <td className="p-3 text-right whitespace-nowrap">{sale.bales}</td>
                      <td className="p-3 text-right whitespace-nowrap">{sale.massPurchased.toFixed(2)} Kg</td>
                      <td className="p-3 text-right whitespace-nowrap">{formatUsd(sale.valuePurchased)}</td>
                      <td className="p-3 text-right whitespace-nowrap">{formatUsd(sale.averagePrice)}</td>
                    </tr>
                    {expandedSales[sale.rowKey] && (
                      <tr>
                        <td colSpan="7" className="p-0">
                          <div className={`border-t ${darkMode ? 'border-gray-700 bg-gray-900/30' : 'border-gray-100 bg-gray-50/60'} px-4 py-3`}>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wide opacity-70">Drill Down</p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b dark:border-gray-700 opacity-70">
                                  <th className="p-2 text-left">PCN Number</th>
                                  <th className="p-2 text-right">Bales</th>
                                  <th className="p-2 text-right">Mass</th>
                                  <th className="p-2 text-right">Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sale.pcns.map((pcn) => (
                                  <tr key={pcn.pcnNumber} className="border-b last:border-0 dark:border-gray-700">
                                    <td className="p-2 font-medium">{pcn.pcnNumber}</td>
                                    <td className="p-2 text-right">{pcn.bales}</td>
                                    <td className="p-2 text-right">{pcn.mass.toFixed(2)} Kg</td>
                                    <td className="p-2 text-right">{formatUsd(pcn.value)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {salesSummaryData.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-3 text-sm text-gray-500">No sales to display for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700/80 border-b-2 border-gray-200 dark:border-gray-600">
                <tr>
                   {currentReport.headers.map((h, i) => (
                     <th key={i} className={`p-3 font-black uppercase tracking-wider text-[10px] text-gray-500 dark:text-gray-400 ${getColumnAlignment(h)}`}>
                        {h}
                     </th>
                   ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {currentReport.rows.map((row, i) => (
                   <tr key={i} className="hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors">
                     {row.map((c, j) => {
                        const header = currentReport.headers[j];
                        return (
                          <td key={j} className={`p-3 whitespace-nowrap ${getColumnAlignment(header)} ${getCellColor(c, header)}`}>
                             {c}
                          </td>
                        );
                     })}
                   </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reports;
