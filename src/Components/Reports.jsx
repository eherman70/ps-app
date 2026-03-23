import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useStorage } from '../hooks/useStorage';
import { Download, FileSpreadsheet, Users, Leaf, Banknote, Tag, Printer, ChevronDown, ChevronRight } from 'lucide-react';

function Reports() {
  const { darkMode, currentUser, activePS } = useAppContext();
  
  // Fetch required data directly using standard app context hooks
  const { items: farmers } = useStorage('farmer');
  const { items: seasons } = useStorage('season');
  const { items: inputs } = useStorage('issuedinput');
  const { items: inputTypes } = useStorage('inputtype');
  const { items: tickets } = useStorage('ticket');
  const { items: payments } = useStorage('payment');

  const [reportType, setReportType] = useState('sales'); 
  const [seasonFilter, setSeasonFilter] = useState('');
  const [expandedSales, setExpandedSales] = useState({});
  const [selectedSales, setSelectedSales] = useState([]);
  const [showSalesMenu, setShowSalesMenu] = useState(false);
  const [salesSummary, setSalesSummary] = useState([]);

  // isSupervisor check
  const isSupervisor = currentUser.role === 'Supervisor' || currentUser.role === 'Admin';
  const activePSValue = isSupervisor ? (activePS || 'All') : currentUser.ps;
  
  // Load specialized sales summary from API
  useEffect(() => {
    const loadSalesSummary = async () => {
      try {
        const data = await window.api.request('/reports/sales-by-sale');
        setSalesSummary(data || []);
      } catch (e) {
        console.error('Failed to load sales summary:', e);
      }
    };
    if (reportType === 'sales') {
      loadSalesSummary();
    }
  }, [reportType]);

  const toggleSale = (sale) => {
    setSelectedSales(prev => prev.includes(sale) ? prev.filter(s => s !== sale) : [...prev, sale]);
  };
  
  const getFarmerName = (id) => {
    const f = farmers.find(f => f.id === id);
    return f ? `${f.farmerNumber} - ${f.firstName} ${f.lastName}` : 'Unknown';
  };

  const getInputTypeName = (id) => {
    const i = inputTypes.find(type => type.id === id);
    return i ? i.name : 'Unknown';
  };

  // CSV Exporter
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

  // --- RENDER FARMERS REPORT ---
  const renderFarmersReport = () => {
    let data = farmers.filter(f => activePSValue === 'All' || f.ps === activePSValue);
    if (seasonFilter) {
      data = data.filter(f => f.seasonId === seasonFilter || f.season === seasonFilter);
    }

    const headers = ['Farmer #', 'Full Name', 'Gender', 'Village', 'Phone', 'Hectares', 'Contracted Volume (Kg)', 'Season', 'PS'];
    
    return {
      headers,
      rows: data.map(f => [
        f.farmerNumber, 
        `${f.firstName} ${f.lastName}`, 
        f.gender || '-', f.village, f.phoneNumber || '-', 
        f.hectares || '0', f.contractedVolume || '0', 
        f.seasonName || f.season || '-',
        f.ps
      ]),
      title: 'Farmer Registration List'
    };
  };

  // --- RENDER INPUTS REPORT ---
  const renderInputsReport = () => {
    let data = inputs.filter(i => activePSValue === 'All' || i.ps === activePSValue);
    
    const headers = ['Issue Date', 'Farmer', 'Input Item', 'Quantity', 'Total Cost (USD)', 'PS'];
    
    return {
      headers,
      rows: data.map(i => [
        new Date(i.issueDate || i.createdAt).toLocaleDateString(),
        getFarmerName(i.farmerId),
        i.inputName || getInputTypeName(i.inputTypeId),
        i.quantity,
        `$${parseFloat(i.totalCost || i.totalValue || 0).toFixed(2)}`,
        i.ps
      ]),
      title: 'Agricultural Inputs & Advances Report'
    };
  };

  // --- ACCORDION SALES DATA ---
  const getSalesAccordionData = () => {
    let data = tickets.filter(t => activePSValue === 'All' || t.ps === activePSValue);
    if (selectedSales.length > 0) {
        data = data.filter(t => selectedSales.includes(t.saleNumber));
    }
    
    const salesMap = {};
    data.forEach(t => {
      const saleNum = t.saleNumber;
      if (!salesMap[saleNum]) {
        salesMap[saleNum] = {
          saleNumber: saleNum,
          tickets: [],
          mass: 0,
          value: 0,
          marketCenter: t.marketCenterName || t.marketCenter || '-'
        };
      }
      salesMap[saleNum].tickets.push(t);
      salesMap[saleNum].mass += parseFloat(t.netWeight || t.mass || 0);
      salesMap[saleNum].value += parseFloat(t.totalValue || t.value || 0);
    });

    return Object.values(salesMap).map(sale => {
      const farmerMap = {};
      sale.tickets.forEach(t => {
        const fKey = t.farmerId;
        if (!farmerMap[fKey]) {
          farmerMap[fKey] = {
            farmerName: t.firstName ? `${t.firstName} ${t.lastName}` : (t.farmerName || getFarmerName(t.farmerId)),
            bales: 0,
            mass: 0,
            value: 0
          };
        }
        farmerMap[fKey].bales += 1;
        farmerMap[fKey].mass += parseFloat(t.netWeight || t.mass || 0);
        farmerMap[fKey].value += parseFloat(t.totalValue || t.value || 0);
      });

      return {
        ...sale,
        bales: sale.tickets.length,
        avgPrice: sale.mass > 0 ? (sale.value / sale.mass).toFixed(2) : '0.00',
        farmers: Object.values(farmerMap).map(f => ({
          ...f,
          avgPrice: f.mass > 0 ? (f.value / f.mass).toFixed(2) : '0.00'
        }))
      };
    });
  };

  // --- RENDER PAYMENTS REPORT ---
  const renderPaymentsReport = () => {
    let data = payments.filter(p => activePSValue === 'All' || p.ps === activePSValue);
    
    const headers = ['Date', 'Farmer', 'Tobacco (USD)', 'Inputs (USD)', 'USD Baki', 'Rate', 'Gross TZS', 'Levy/Admin', 'Net TZS', 'PS'];
    
    return {
      headers,
      rows: data.map(p => {
        const levyAdmin = (parseFloat(p.levy || 0) + parseFloat(p.adminFee || 0)).toLocaleString();
        return [
          new Date(p.paymentDate || p.createdAt).toLocaleDateString(),
          `${p.farmerNumber || ''} ${p.firstName || ''} ${p.lastName || ''}`.trim() || getFarmerName(p.farmerId),
          `$${parseFloat(p.tobaccoAmount || 0).toFixed(2)}`,
          `$${parseFloat(p.inputDeduction || 0).toFixed(2)}`,
          `$${parseFloat(p.usdBalance || 0).toFixed(2)}`,
          p.exchangeRate || '-',
          parseFloat(p.tzsGross || 0).toLocaleString(),
          levyAdmin,
          parseFloat(p.netPayment || 0).toLocaleString(),
          p.ps
        ];
      }),
      title: 'Farmer Payment & Disbursement Report'
    };
  };

  // Get current active report payload
  let currentReport = { title: '', headers: [], rows: [] };
  if (reportType === 'farmers') currentReport = renderFarmersReport();
  if (reportType === 'inputs') currentReport = renderInputsReport();
  if (reportType === 'payments') currentReport = renderPaymentsReport();

  const handleExport = () => {
    if (reportType === 'sales') {
      const flatSales = [];
      const headers = ['Sale Number', 'Market Center', 'Farmer Name', 'Bales', 'Mass (Kg)', 'Gross Value (USD)', 'Avg Price'];
      getSalesAccordionData().forEach(sale => {
        sale.farmers.forEach(f => {
          flatSales.push([sale.saleNumber, sale.marketCenter, f.farmerName, f.bales, f.mass.toFixed(2), `$${f.value.toFixed(2)}`, `$${f.avgPrice}`]);
        });
      });
      exportToCSV(`PS_Sales_Detailed_Report`, [headers, ...flatSales]);
    } else {
      exportToCSV(`PS_${currentReport.title.replace(/ /g, '_')}`, [currentReport.headers, ...currentReport.rows]);
    }
  };

  const navBtn = (id, label, Icon) => (
    <button
      onClick={() => setReportType(id)}
      className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${
        reportType === id
          ? 'bg-green-600 text-white shadow-lg scale-105'
          : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
      }`}
    >
      <Icon className="w-5 h-5 transition-transform" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="print:m-0 print:p-0">
      {/* Print Header */}
      <div className="hidden print:block mb-8 border-b-2 border-black pb-4 text-center">
        <h1 className="text-3xl font-bold uppercase tracking-widest text-black">PRIMARY SOCIETY MANAGEMENT SYSTEM</h1>
        <p className="text-gray-600 mt-1 uppercase tracking-widest font-semibold text-lg">{reportType === 'sales' ? 'Detailed Tobacco Sales Report' : currentReport.title}</p>
        <div className="text-gray-500 text-sm mt-1 grid grid-cols-3">
            <span>Generated: {new Date().toLocaleString()}</span>
            <span>User: {currentUser?.fullName}</span>
            <span>PS: {activePSValue}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6 print:hidden">
        <h2 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">System Reports</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md transition font-medium"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition font-medium"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 print:hidden">
        {navBtn('farmers', 'Farmer List', Users)}
        {navBtn('inputs', 'Inputs & Advances', Leaf)}
        {navBtn('sales', 'Sales & Tickets', Tag)}
        {navBtn('payments', 'Payment History', Banknote)}
      </div>

      <div className={`overflow-hidden rounded-2xl shadow-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} print:shadow-none print:border-none print:rounded-none`}>
        <div className={`p-5 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50'} flex justify-between items-center print:hidden`}>
          <h3 className="text-xl font-bold flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-green-600" />
            </div>
            <span>{reportType === 'sales' ? 'Detailed Tobacco Sales Report' : currentReport.title}</span>
          </h3>
          
          <div className="flex items-center gap-3">
            {reportType === 'farmers' && (
              <select
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value)}
                className={`px-4 py-2 border rounded-xl text-sm transition outline-none focus:ring-2 focus:ring-green-500 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">All Seasons</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}

            {reportType === 'sales' && (
              <div className="relative">
                <button
                  onClick={() => setShowSalesMenu(!showSalesMenu)}
                  className={`flex items-center space-x-2 px-4 py-2 border rounded-xl text-sm transition outline-none focus:ring-2 focus:ring-green-500 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <span>{selectedSales.length === 0 ? 'Filter Sale Numbers' : `${selectedSales.length} Sales Selected`}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showSalesMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showSalesMenu && (
                  <div className={`absolute right-0 mt-3 w-64 rounded-xl shadow-2xl z-50 border p-2 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-gray-200/50'}`}>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {Array.from(new Set(tickets.map(t => t.saleNumber))).filter(Boolean).sort().map(sn => (
                        <label key={sn} className={`flex items-center space-x-3 p-2.5 rounded-lg cursor-pointer transition ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-green-50'}`}>
                          <input
                            type="checkbox"
                            checked={selectedSales.includes(sn)}
                            onChange={() => toggleSale(sn)}
                            className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                          />
                          <span className="text-sm font-semibold">{sn}</span>
                        </label>
                      ))}
                      {Array.from(new Set(tickets.map(t => t.saleNumber))).filter(Boolean).length === 0 && (
                        <p className="text-sm text-gray-500 p-4 text-center">No sales data available</p>
                      )}
                    </div>
                  </div>
                )}
                {showSalesMenu && <div className="fixed inset-0 z-40" onClick={() => setShowSalesMenu(false)}></div>}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[70vh] print:max-h-none print:overflow-visible custom-scrollbar">
          {reportType === 'sales' ? (
            <table className="w-full text-sm text-left print:text-black">
              <thead className={`text-xs uppercase sticky top-0 z-10 print:static ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                <tr>
                  <th className="px-6 py-4 font-bold print:hidden w-12"></th>
                  <th className="px-6 py-4 font-bold">Sale Number / Market</th>
                  <th className="px-6 py-4 font-bold text-center">Bales</th>
                  <th className="px-6 py-4 font-bold text-right">Mass (Kg)</th>
                  <th className="px-6 py-4 font-bold text-right">Gross Value (USD)</th>
                  <th className="px-6 py-4 font-bold text-right">Avg Price (USD/Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-400">
                {getSalesAccordionData().map(sale => (
                  <React.Fragment key={sale.saleNumber}>
                    <tr 
                      className={`cursor-pointer transition ${darkMode ? 'hover:bg-gray-700/60' : 'hover:bg-green-50/40'} ${expandedSales[sale.saleNumber] ? (darkMode ? 'bg-gray-700/40' : 'bg-green-50/60') : ''}`}
                      onClick={() => setExpandedSales(prev => ({...prev, [sale.saleNumber]: !prev[sale.saleNumber]}))}
                    >
                      <td className="px-6 py-5 print:hidden">
                        <div className={`p-1 rounded-md transition-colors ${expandedSales[sale.saleNumber] ? 'bg-green-100 text-green-600' : 'text-gray-400'}`}>
                            {expandedSales[sale.saleNumber] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-extrabold text-lg text-green-700 dark:text-green-400 print:text-black">{sale.saleNumber}</div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-tighter">{sale.marketCenter}</div>
                      </td>
                      <td className="px-6 py-5 font-bold text-center">{sale.bales}</td>
                      <td className="px-6 py-5 font-bold text-right">{sale.mass.toFixed(2)}</td>
                      <td className="px-6 py-5 font-bold text-right text-green-600 dark:text-green-400">${sale.value.toFixed(2)}</td>
                      <td className="px-6 py-5 font-bold text-right text-blue-600 dark:text-blue-400 underline decoration-blue-500/30 underline-offset-4">${sale.avgPrice}</td>
                    </tr>
                    {expandedSales[sale.saleNumber] && sale.farmers.map((f, i) => (
                      <tr key={`${sale.saleNumber}-${i}`} className={`${darkMode ? 'bg-gray-900/40' : 'bg-gray-50'} text-xs print:bg-white`}>
                        <td className="px-6 py-3 print:hidden"></td>
                        <td className="px-6 py-3 border-l-4 border-green-500 pl-4 print:border-black font-semibold text-gray-700 dark:text-gray-300">
                          <span className="text-gray-400 mr-2 text-base">↳</span>{f.farmerName}
                        </td>
                        <td className="px-6 py-3 text-center">{f.bales}</td>
                        <td className="px-6 py-3 text-right">{f.mass.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right font-medium text-green-600 dark:text-green-500">${f.value.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right text-gray-500">${f.avgPrice}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {getSalesAccordionData().length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-24 text-center text-gray-400 font-medium animate-pulse italic text-lg">
                        Select sale numbers or check if data exists.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left print:text-black">
              <thead className={`text-xs uppercase sticky top-0 z-10 print:static ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'} print:bg-gray-50 print:text-black`}>
                <tr>
                  {currentReport.headers.map((h, i) => (
                    <th key={i} className="px-6 py-4 font-bold border-b dark:border-gray-600 print:border-black whitespace-nowrap">
                        {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-300">
                {currentReport.rows.map((row, i) => (
                  <tr key={i} className={`hover:${darkMode ? 'bg-gray-750' : 'bg-blue-50/40'} transition print:bg-white`}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-6 py-4 font-medium text-gray-700 dark:text-gray-200 print:text-black whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                {currentReport.rows.length === 0 && (
                  <tr>
                    <td colSpan={currentReport.headers.length} className="px-6 py-24 text-center text-gray-400 italic text-lg">
                      No matching records found for this report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reports;
