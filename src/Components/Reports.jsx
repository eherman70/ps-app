import React, { useState } from 'react';
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

  const [reportType, setReportType] = useState('sales'); // default to sales as per recent request emphasis
  const [seasonFilter, setSeasonFilter] = useState('');
  const [expandedSales, setExpandedSales] = useState({});
  const [selectedSales, setSelectedSales] = useState([]);
  const [showSalesMenu, setShowSalesMenu] = useState(false);

  const activePSValue = currentUser.role === 'admin' ? (activePS || 'All') : currentUser.ps;
  
  const toggleSale = (sale) => {
    setSelectedSales(prev => prev.includes(sale) ? prev.filter(s => s !== sale) : [...prev, sale]);
  };
  
  // Helper to get nested name
  const getFarmerName = (id) => {
    const f = farmers.find(f => f.id === id);
    return f ? `${f.farmerNumber} - ${f.firstName} ${f.lastName}` : 'Unknown';
  };
  const geInputTypeName = (id) => {
    const i = inputTypes.find(type => type.id === id);
    return i ? i.name : 'Unknown';
  };

  // CSV Exporter Native Web API
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
    if (seasonFilter) data = data.filter(f => f.season === seasonFilter || f.seasonId === seasonFilter);

    const headers = ['Farmer #', 'First Name', 'Last Name', 'Gender', 'Village', 'Phone', 'Hectares', 'Volume(kg)', 'Season'];
    
    return {
      headers,
      rows: data.map(f => [
        f.farmerNumber, f.firstName, f.lastName, f.gender || '-', f.village, f.phoneNumber, f.hectares || '0', f.contractedVolume || '0', f.season || f.seasonId || '-'
      ]),
      title: 'Farmer Registration List'
    };
  };

  // --- RENDER INPUTS REPORT ---
  const renderInputsReport = () => {
    let data = inputs.filter(i => activePSValue === 'All' || i.ps === activePSValue);
    
    const headers = ['Issue Date', 'Farmer', 'Input Item', 'Quantity', 'Total Cost', 'Doc Ref', 'Notes'];
    
    return {
      headers,
      rows: data.map(i => [
        new Date(i.issueDate).toLocaleDateString(),
        getFarmerName(i.farmerId),
        geInputTypeName(i.inputTypeId),
        i.quantity,
        `$${parseFloat(i.totalCost).toFixed(2)}`,
        i.documentRef || '-',
        i.notes || '-'
      ]),
      title: 'Agricultural Inputs Report'
    };
  };

  // --- ACCORDION SALES DATA ---
  const getSalesAccordionData = () => {
    let data = tickets.filter(t => activePSValue === 'All' || t.ps === activePSValue);
    if (reportType === 'sales' && selectedSales.length > 0) {
        data = data.filter(t => selectedSales.includes(t.saleNumber));
    }
    
    const salesMap = {};
    data.forEach(t => {
      if (!salesMap[t.saleNumber]) {
        salesMap[t.saleNumber] = {
          saleNumber: t.saleNumber,
          tickets: [],
          mass: 0,
          value: 0,
          marketCenter: t.marketCenter
        };
      }
      salesMap[t.saleNumber].tickets.push(t);
      salesMap[t.saleNumber].mass += parseFloat(t.mass || 0);
      salesMap[t.saleNumber].value += parseFloat(t.value || 0);
    });

    return Object.values(salesMap).map(sale => {
      const farmerMap = {};
      sale.tickets.forEach(t => {
        if (!farmerMap[t.farmerId]) {
          farmerMap[t.farmerId] = {
            farmerName: t.farmerName || getFarmerName(t.farmerId),
            bales: 0,
            mass: 0,
            value: 0
          };
        }
        farmerMap[t.farmerId].bales += 1;
        farmerMap[t.farmerId].mass += parseFloat(t.mass || 0);
        farmerMap[t.farmerId].value += parseFloat(t.value || 0);
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
    
    const headers = ['Payment Date', 'Farmer', 'Tobacco Gross Value', 'Inputs Deducted', 'Net Payable', 'Payee Name', 'Account / Phone'];
    
    return {
      headers,
      rows: data.map(p => [
        new Date(p.paymentDate).toLocaleDateString(),
        getFarmerName(p.farmerId),
        `$${parseFloat(p.tobaccoAmount).toFixed(2)}`,
        `$${parseFloat(p.inputDeduction).toFixed(2)}`,
        `$${parseFloat(p.netPayment).toFixed(2)}`,
        p.payeeName,
        p.accountNumber
      ]),
      title: 'Farmer Net Payment Report'
    };
  };

  // Get current active report payload (for standard reports)
  let currentReport = { title: 'Sales Report', headers: [], rows: [] };
  if (reportType === 'farmers') currentReport = renderFarmersReport();
  if (reportType === 'inputs') currentReport = renderInputsReport();
  if (reportType === 'payments') currentReport = renderPaymentsReport();

  const handleExport = () => {
    if (reportType === 'sales') {
      // Create a flat export for sales
      const flatSales = [];
      const headers = ['Sale Number', 'Market Center', 'Farmer Name', 'Bales', 'Mass (Kg)', 'Gross Value', 'Avg Price'];
      getSalesAccordionData().forEach(sale => {
        sale.farmers.forEach(f => {
          flatSales.push([sale.saleNumber, sale.marketCenter, f.farmerName, f.bales, f.mass.toFixed(2), `$${f.value.toFixed(2)}`, `$${f.avgPrice}`]);
        });
      });
      exportToCSV(`TFMSTS_Sales_Report`, [headers, ...flatSales]);
    } else {
      exportToCSV(`TFMSTS_${currentReport.title.replace(/ /g, '_')}`, [currentReport.headers, ...currentReport.rows]);
    }
  };

  const navBtn = (id, label, Icon) => (
    <button
      onClick={() => setReportType(id)}
      className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition ${
        reportType === id
          ? 'bg-green-600 text-white shadow-md'
          : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="print:m-0 print:p-0">
      <div className="hidden print:block mb-8 border-b-2 border-black pb-4 text-center">
        <h1 className="text-3xl font-bold uppercase tracking-widest text-black">Mkwawa Leaf Tobacco Limited</h1>
        <p className="text-gray-600 mt-1 uppercase tracking-widest font-semibold text-lg">{reportType === 'sales' ? 'Expandable Tobacco Sales Report' : currentReport.title}</p>
        <p className="text-gray-500 text-sm mt-1">Generated: {new Date().toLocaleString()} | User: {currentUser?.fullName}</p>
      </div>

      <div className="flex justify-between items-center mb-6 print:hidden">
        <h2 className="text-2xl font-bold">System Reports</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:hidden">
        {navBtn('farmers', 'Farmer List', Users)}
        {navBtn('inputs', 'Inputs Tracking', Leaf)}
        {navBtn('sales', 'Sales & Tickets', Tag)}
        {navBtn('payments', 'Payment Summaries', Banknote)}
      </div>

      <div className={`overflow-hidden rounded-xl shadow-lg border ${darkMode ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' : 'bg-white border-gray-200 shadow-gray-200/50'} print:shadow-none print:border-none print:rounded-none`}>
        <div className={`p-4 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50'} flex justify-between items-center print:hidden`}>
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600 print:hidden" />
            <span>{reportType === 'sales' ? 'Expandable Tobacco Sales Report' : currentReport.title}</span>
          </h3>
          
          {reportType === 'farmers' && (
            <select
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className={`px-3 py-1.5 border rounded-md text-sm print:hidden ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="">All Seasons</option>
              {seasons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          )}

          {reportType === 'sales' && (
            <div className="relative">
              <button
                onClick={() => setShowSalesMenu(!showSalesMenu)}
                className={`flex items-center space-x-2 px-3 py-1.5 border rounded-md text-sm print:hidden transition ${darkMode ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
              >
                <span>{selectedSales.length === 0 ? 'All Sale Numbers' : `${selectedSales.length} Sales Selected`}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {showSalesMenu && (
                <div className={`absolute right-0 mt-2 w-56 rounded-md shadow-xl z-50 border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} print:hidden`}>
                  <div className="p-2 max-h-60 overflow-y-auto">
                    {Array.from(new Set(tickets.map(t => t.saleNumber))).filter(Boolean).map(sn => (
                      <label key={sn} className="flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={selectedSales.includes(sn)}
                          onChange={() => toggleSale(sn)}
                          className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                        />
                        <span className="text-sm font-medium">{sn}</span>
                      </label>
                    ))}
                    {Array.from(new Set(tickets.map(t => t.saleNumber))).filter(Boolean).length === 0 && (
                      <p className="text-sm text-gray-500 p-2 text-center">No sales available</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible">
          {reportType === 'sales' ? (
            <table className="w-full text-sm text-left print:text-black">
              <thead className={`text-xs uppercase sticky top-0 print:static ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                <tr>
                  <th className="px-6 py-4 font-semibold print:hidden w-10"></th>
                  <th className="px-6 py-4 font-semibold">Sale Number / Market</th>
                  <th className="px-6 py-4 font-semibold">Bales</th>
                  <th className="px-6 py-4 font-semibold">Mass (Kg)</th>
                  <th className="px-6 py-4 font-semibold">Gross Value (USD)</th>
                  <th className="px-6 py-4 font-semibold">Avg Price (USD/Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-300">
                {getSalesAccordionData().map(sale => (
                  <React.Fragment key={sale.saleNumber}>
                    <tr 
                      className={`cursor-pointer transition ${darkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'} ${expandedSales[sale.saleNumber] ? (darkMode ? 'bg-gray-750' : 'bg-blue-50/50') : ''}`}
                      onClick={() => setExpandedSales(prev => ({...prev, [sale.saleNumber]: !prev[sale.saleNumber]}))}
                    >
                      <td className="px-6 py-4 print:hidden">
                        {expandedSales[sale.saleNumber] ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-base text-green-600 dark:text-green-400 print:text-black">{sale.saleNumber}</div>
                        <div className="text-xs text-gray-500">{sale.marketCenter}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold">{sale.bales}</td>
                      <td className="px-6 py-4 font-semibold">{sale.mass.toFixed(2)}</td>
                      <td className="px-6 py-4 font-semibold">${sale.value.toFixed(2)}</td>
                      <td className="px-6 py-4 font-semibold">${sale.avgPrice}</td>
                    </tr>
                    {expandedSales[sale.saleNumber] && sale.farmers.map((f, i) => (
                      <tr key={`${sale.saleNumber}-${i}`} className={`${darkMode ? 'bg-gray-900/50' : 'bg-gray-50/80'} text-xs print:bg-white`}>
                        <td className="px-6 py-2 print:hidden"></td>
                        <td className="px-6 py-2 border-l-2 border-green-500 pl-4 print:border-black font-medium text-gray-700 dark:text-gray-300">
                          <span className="print:hidden text-gray-400 mr-2">↳</span>{f.farmerName}
                        </td>
                        <td className="px-6 py-2">{f.bales}</td>
                        <td className="px-6 py-2">{f.mass.toFixed(2)}</td>
                        <td className="px-6 py-2">${f.value.toFixed(2)}</td>
                        <td className="px-6 py-2">${f.avgPrice}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {getSalesAccordionData().length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500 italic">No sales data found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left print:text-black">
              <thead className={`text-xs uppercase sticky top-0 print:static ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} print:bg-gray-100 print:text-black`}>
                <tr>
                  {currentReport.headers.map((h, i) => <th key={i} className="px-6 py-4 font-bold border-b print:border-black whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-300">
                {currentReport.rows.map((row, i) => (
                  <tr key={i} className={`hover:${darkMode ? 'bg-gray-750' : 'bg-blue-50'} transition print:bg-white`}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-6 py-4 font-medium text-gray-800 dark:text-gray-200 print:text-black whitespace-nowrap">{cell}</td>
                    ))}
                  </tr>
                ))}
                {currentReport.rows.length === 0 && (
                  <tr>
                    <td colSpan={currentReport.headers.length} className="px-6 py-12 text-center text-gray-500 italic">
                      No data found for this report.
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
