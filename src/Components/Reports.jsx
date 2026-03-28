import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useStorage } from '../hooks/useStorage';
import { Download, FileSpreadsheet, Users, Leaf, Banknote, Tag, Printer, ChevronDown, ChevronRight, Star } from 'lucide-react';
import { filterItemsByPS, getScopedPS } from '../utils';

function Reports() {
  const { darkMode, currentUser, activePS } = useAppContext();
  
  const { items: farmers } = useStorage('farmer');
  const { items: seasons } = useStorage('season');
  const { items: inputs } = useStorage('issuedinput');
  const { items: inputTypes } = useStorage('inputtype');
  const { items: tickets } = useStorage('ticket');
  const { items: payments } = useStorage('payment');
  const { items: grades } = useStorage('grade');

  const [reportType, setReportType] = useState('sales'); 
  const [seasonFilter, setSeasonFilter] = useState('');
  const [showSalesMenu, setShowSalesMenu] = useState(false);
  const [selectedSales, setSelectedSales] = useState([]);
  const [expandedSales, setExpandedSales] = useState({});
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  const isSupervisor = currentUser.role === 'Supervisor' || currentUser.role === 'Admin';
  const activePSValue = getScopedPS(currentUser, activePS);
  const scopedFarmers = useMemo(() => filterItemsByPS(farmers, activePSValue), [farmers, activePSValue]);
  const scopedInputs = useMemo(() => filterItemsByPS(inputs, activePSValue), [inputs, activePSValue]);
  const scopedTickets = useMemo(() => filterItemsByPS(tickets, activePSValue), [tickets, activePSValue]);
  const scopedPayments = useMemo(() => filterItemsByPS(payments, activePSValue), [payments, activePSValue]);

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

  const formatUsd = (value) => `$${parseFloat(value || 0).toFixed(2)}`;
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

  const renderFarmersReport = () => {
    let data = [...scopedFarmers];
    if (seasonFilter) data = data.filter(f => f.seasonId === seasonFilter || f.season === seasonFilter);
    const formatVolumeKg = (value) => `${Math.round(parseFloat(value || 0))} kgs`;
    const headers = ['Farmer #', 'Full Name', 'Gender', 'Village', 'Phone', 'Hectares', 'Vol(Kg)', 'Season', 'PS'];
    return {
      headers,
      rows: data.map(f => [
        f.farmerNumber, `${f.firstName} ${f.lastName}`, f.gender || '-', f.village, f.phoneNumber || '-', 
        f.hectares || '0', formatVolumeKg(f.contractedVolume), f.seasonName || f.season || '-', f.ps
      ]),
      title: 'Farmer Registration List'
    };
  };

  const renderInputsReport = () => {
    let data = [...scopedInputs];
    const headers = ['Issue Date', 'Farmer', 'Input Item', 'Quantity', 'Total Cost (USD)', 'PS'];
    return {
      headers,
      rows: data.map(i => [
        new Date(i.issueDate || i.createdAt).toLocaleDateString(),
        getFarmerName(i.farmerId),
        i.inputName || getInputTypeName(i.inputTypeId),
        i.quantity,
        formatUsd(i.totalCost || i.totalValue || 0),
        i.ps
      ]),
      title: 'Agricultural Inputs Report'
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
      title: 'Grade Distribution Report'
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
    return { headers, rows, title: 'Premium Leaf Production Ratio' };
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
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl shadow-sm">
            <p className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-1">Premium L-OF</p>
            <p className="text-2xl font-black text-amber-600">{pStat.count} Bales / {pStat.weight.toFixed(1)}kg</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-gray-800 dark:text-gray-400 uppercase tracking-widest mb-1">Standard L-O</p>
            <p className="text-2xl font-black text-gray-600">{sStat.count} Bales / {sStat.weight.toFixed(1)}kg</p>
          </div>
          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-rose-800 dark:text-rose-400 uppercase tracking-widest mb-1">Reject (REJ)</p>
            <p className="text-2xl font-black text-rose-600">{rStat.count} Bales ({rRate}%)</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-green-800 dark:text-green-400 uppercase tracking-widest mb-1">Production Ratio</p>
            <p className="text-2xl font-black text-green-600">{pRatio}% Premium</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 rounded-xl flex justify-between items-center">
            <span className="text-sm font-bold text-orange-700 dark:text-orange-400">Total Cancelled (CAN)</span>
            <span className="text-xl font-black text-orange-600">{canTicks.length} Bales</span>
          </div>
          <div className="p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 rounded-xl flex justify-between items-center">
            <span className="text-sm font-bold text-orange-700 dark:text-orange-400">Total Withdrawn (WIT)</span>
            <span className="text-xl font-black text-orange-600">{witTicks.length} Bales</span>
          </div>
        </div>
      </div>
    );
  };

  const renderPaymentsReport = () => {
    let data = [...scopedPayments];
    const headers = ['Date', 'Farmer', 'Tobacco (USD)', 'Inputs (USD)', 'Net USD', 'Rate', 'Net TZS', 'PS'];
    return {
      headers,
      rows: data.map(p => [
        new Date(p.paymentDate || p.createdAt).toLocaleDateString(),
        getFarmerName(p.farmerId),
        formatUsd(p.tobaccoAmount || 0),
        formatUsd(p.inputDeduction || 0),
        formatUsd(p.usdBalance || 0),
        p.exchangeRate || '-',
        formatTzs(p.netPayment || 0),
        p.ps
      ]),
      title: 'Farmer Payment Report'
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

  const handleExport = () => {
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
      exportToCSV('Tobacco_Sales_Summary', [headers, ...rows]);
    } else {
      exportToCSV(currentReport.title.replace(/ /g, '_'), [currentReport.headers, ...currentReport.rows]);
    }
  };

  const navBtn = (id, label, Icon) => (
    <button
      onClick={() => setReportType(id)}
      className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
        reportType === id ? 'bg-green-600 text-white shadow-lg' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-100 border'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold">System Reports</h2>
        <div className="flex space-x-3">
          <button onClick={handlePrintReport} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg"><Printer className="w-5 h-5" /></button>
          <button onClick={handleExport} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"><Download className="w-4 h-4" /> <span>Export</span></button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
        {navBtn('sales', 'Sales', Leaf)}
        {navBtn('farmers', 'Farmers', Users)}
        {navBtn('inputs', 'Inputs', FileSpreadsheet)}
        {navBtn('grades', 'Grades', Tag)}
        {navBtn('premium', 'Premium', Star)}
        {isSupervisor && navBtn('payments', 'Payments', Banknote)}
      </div>

      <div className={`report-print-area overflow-hidden rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <h3 className="font-bold flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <span>{reportType === 'sales' ? 'Tobacco Sales Summary' : currentReport.title}</span>
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
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>{currentReport.headers.map((h, i) => <th key={i} className="p-3 text-left font-bold uppercase text-[10px]">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {currentReport.rows.map((row, i) => <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">{row.map((c, j) => <td key={j} className="p-3 whitespace-nowrap">{c}</td>)}</tr>)}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reports;
