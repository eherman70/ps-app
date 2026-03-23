import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useStorage } from '../hooks/useStorage';
import { Download, FileSpreadsheet, Users, Leaf, Banknote, Tag, Printer, ChevronDown, ChevronRight, Star } from 'lucide-react';

function Reports() {
  const { darkMode, currentUser, activePS } = useAppContext();
  
  const { items: farmers } = useStorage('farmer');
  const { items: seasons } = useStorage('season');
  const { items: inputs } = useStorage('issuedinput');
  const { items: inputTypes } = useStorage('inputtype');
  const { items: tickets } = useStorage('ticket');
  const { items: payments } = useStorage('payment');

  const [reportType, setReportType] = useState('sales'); 
  const [seasonFilter, setSeasonFilter] = useState('');
  const [showSalesMenu, setShowSalesMenu] = useState(false);
  const [selectedSales, setSelectedSales] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  const isSupervisor = currentUser.role === 'Supervisor' || currentUser.role === 'Admin';
  const activePSValue = isSupervisor ? (activePS || 'All') : currentUser.ps;
  
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
    let data = farmers.filter(f => activePSValue === 'All' || f.ps === activePSValue);
    if (seasonFilter) data = data.filter(f => f.seasonId === seasonFilter || f.season === seasonFilter);
    const headers = ['Farmer #', 'Full Name', 'Gender', 'Village', 'Phone', 'Hectares', 'Vol(Kg)', 'Season', 'PS'];
    return {
      headers,
      rows: data.map(f => [
        f.farmerNumber, `${f.firstName} ${f.lastName}`, f.gender || '-', f.village, f.phoneNumber || '-', 
        f.hectares || '0', f.contractedVolume || '0', f.seasonName || f.season || '-', f.ps
      ]),
      title: 'Farmer Registration List'
    };
  };

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
      title: 'Agricultural Inputs Report'
    };
  };

  const renderGradesReport = () => {
    let data = tickets.filter(t => activePSValue === 'All' || t.ps === activePSValue);
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
      rows: result.map(g => [g.code, g.name, g.category, g.level, g.bales.toString(), g.weight.toFixed(2), g.value.toFixed(2)]),
      title: 'Grade Distribution Report'
    };
  };

  const renderPremiumReport = () => {
    const data = tickets.filter(t => activePSValue === 'All' || t.ps === activePSValue);
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
    const pTicks = tickets.filter(t => t.grade_code && t.grade_code.endsWith('OF') && (activePSValue === 'All' || t.ps === activePSValue));
    const sTicks = tickets.filter(t => t.grade_code && t.grade_code.includes('O') && !t.grade_code.endsWith('OF') && (activePSValue === 'All' || t.ps === activePSValue));

    const pStat = { count: pTicks.length, weight: pTicks.reduce((s,t) => s + parseFloat(t.netWeight || t.mass || 0), 0) };
    const sStat = { count: sTicks.length, weight: sTicks.reduce((s,t) => s + parseFloat(t.netWeight || t.mass || 0), 0) };

    return (
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 rounded-lg">
          <p className="text-[10px] font-bold text-amber-800 uppercase">Premium L-OF</p>
          <p className="text-xl font-black text-amber-600">{pStat.count} Bales / {pStat.weight.toFixed(1)}kg</p>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 rounded-lg">
          <p className="text-[10px] font-bold text-gray-800 uppercase">Standard L-O</p>
          <p className="text-xl font-black text-gray-600">{sStat.count} Bales / {sStat.weight.toFixed(1)}kg</p>
        </div>
      </div>
    );
  };

  const renderPaymentsReport = () => {
    let data = payments.filter(p => activePSValue === 'All' || p.ps === activePSValue);
    const headers = ['Date', 'Farmer', 'Tobacco (USD)', 'Inputs (USD)', 'Net USD', 'Rate', 'Net TZS', 'PS'];
    return {
      headers,
      rows: data.map(p => [
        new Date(p.paymentDate || p.createdAt).toLocaleDateString(),
        getFarmerName(p.farmerId),
        `$${parseFloat(p.tobaccoAmount || 0).toFixed(2)}`,
        `$${parseFloat(p.inputDeduction || 0).toFixed(2)}`,
        `$${parseFloat(p.usdBalance || 0).toFixed(2)}`,
        p.exchangeRate || '-',
        parseFloat(p.netPayment || 0).toLocaleString(),
        p.ps
      ]),
      title: 'Farmer Payment Report'
    };
  };

  const getSalesAccordionData = () => {
    let data = tickets.filter(t => activePSValue === 'All' || t.ps === activePSValue);
    if (selectedSales.length > 0) data = data.filter(t => selectedSales.includes(t.saleNumber));
    const salesMap = {};
    data.forEach(t => {
      const saleNum = t.saleNumber;
      if (!salesMap[saleNum]) salesMap[saleNum] = { saleNumber: saleNum, tickets: [], mass: 0, value: 0, marketCenter: t.marketCenterName || t.marketCenter || '-' };
      salesMap[saleNum].tickets.push(t);
      salesMap[saleNum].mass += parseFloat(t.netWeight || t.mass || 0);
      salesMap[saleNum].value += parseFloat(t.totalValue || t.value || 0);
    });
    return Object.values(salesMap).map(sale => {
      const farmerMap = {};
      sale.tickets.forEach(t => {
        const fKey = t.farmerId;
        if (!farmerMap[fKey]) farmerMap[fKey] = { name: getFarmerName(t.farmerId), bales: 0, mass: 0, value: 0 };
        farmerMap[fKey].bales += 1;
        farmerMap[fKey].mass += parseFloat(t.netWeight || t.mass || 0);
        farmerMap[fKey].value += parseFloat(t.totalValue || t.value || 0);
      });
      return { ...sale, farmers: Object.values(farmerMap) };
    });
  };

  let currentReport = { title: '', headers: [], rows: [] };
  if (reportType === 'farmers') currentReport = renderFarmersReport();
  else if (reportType === 'inputs') currentReport = renderInputsReport();
  else if (reportType === 'grades') currentReport = renderGradesReport();
  else if (reportType === 'premium') currentReport = renderPremiumReport();
  else if (reportType === 'payments' && isSupervisor) currentReport = renderPaymentsReport();

  const handleExport = () => {
    if (reportType === 'sales') {
      const headers = ['Sale', 'Market', 'Farmer', 'Bales', 'Mass', 'Value'];
      const rows = [];
      getSalesAccordionData().forEach(s => s.farmers.forEach(f => rows.push([s.saleNumber, s.marketCenter, f.name, f.bales, f.mass.toFixed(2), f.value.toFixed(2)])));
      exportToCSV('Sales_Detailed', [headers, ...rows]);
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
          <button onClick={() => window.print()} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg"><Printer className="w-5 h-5" /></button>
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

      <div className={`overflow-hidden rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <h3 className="font-bold flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <span>{reportType === 'sales' ? 'Detailed Tobacco Sales' : currentReport.title}</span>
          </h3>
          <div className="flex items-center gap-3 print:hidden">
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
            <div className="space-y-4">
              {getSalesAccordionData().map(sale => (
                <div key={sale.saleNumber} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-700/30 px-4 py-2 font-bold text-sm flex justify-between">
                    <span>Sale #{sale.saleNumber} - {sale.marketCenter}</span>
                    <span>{sale.mass.toFixed(1)}kg - ${sale.value.toFixed(2)}</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b dark:border-gray-700 opacity-60"><th className="p-2 text-left">Farmer</th><th className="p-2 text-center">Bales</th><th className="p-2 text-right">Mass</th><th className="p-2 text-right">Value</th></tr></thead>
                    <tbody>{sale.farmers.map((f, i) => (<tr key={i} className="border-b last:border-0 dark:border-gray-700"><td className="p-2 font-medium">{f.name}</td><td className="p-2 text-center">{f.bales}</td><td className="p-2 text-right">{f.mass.toFixed(1)}</td><td className="p-2 text-right">${f.value.toFixed(2)}</td></tr>))}</tbody>
                  </table>
                </div>
              ))}
            </div>
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
