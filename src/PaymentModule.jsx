import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Download, FileText, Plus, Save, Search } from 'lucide-react';

function PaymentModule() {
  const { darkMode, currentUser, activePS } = useAppContext();
  const { items: farmers } = useStorage('farmer');
  const { items: tickets } = useStorage('ticket');
  const { items: inputs } = useStorage('issuedinput');
  const { items: inputTypes } = useStorage('inputtype');
  const { items: seasons } = useStorage('season');

  const role = (currentUser?.role || '').toLowerCase();
  const isSupervisor = role === 'admin' || role === 'supervisor';

  const [selectedSeason, setSelectedSeason] = useState('');
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

  useEffect(() => {
    if (seasons.length && !selectedSeason) {
      setSelectedSeason(seasons[0].name || seasons[0].id);
    }
  }, [seasons, selectedSeason]);

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
    const scoped = isSupervisor
      ? farmers
      : farmers.filter(f => f.ps === (activePS || currentUser.ps));

    if (!q) return scoped;
    return scoped.filter(f =>
      `${f.farmerNumber || ''} ${f.firstName || ''} ${f.lastName || ''} ${f.ps || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [farmers, search, isSupervisor, activePS, currentUser]);

  const rows = useMemo(() => {
    const calculateDeductionAmount = (deduction, mass) => {
      const amount = parseFloat(deduction?.amount || 0);
      const type = String(deduction?.type || '').toLowerCase();
      if (type.includes('kg')) {
        return amount * mass;
      }
      return amount;
    };

    return filteredFarmers.map((farmer) => {
      const farmerTickets = tickets.filter(t => t.farmerId === farmer.id);
      const farmerInputs = inputs.filter(i => i.farmerId === farmer.id);

      const mass = farmerTickets.reduce((sum, t) => sum + parseFloat(t.mass || t.netWeight || 0), 0);
      const sales = farmerTickets.reduce((sum, t) => sum + parseFloat(t.value || t.totalValue || 0), 0);

      const inputByType = {};
      for (const issue of farmerInputs) {
        const typeName = issue.inputName
          || inputTypes.find(t => t.id === issue.inputTypeId)?.name
          || 'Other';
        inputByType[typeName] = (inputByType[typeName] || 0) + parseFloat(issue.totalCost || issue.totalValue || 0);
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
  }, [filteredFarmers, tickets, inputs, inputTypes, exchangeRates, deductions, globalRate]);

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
    const seasonMatch = seasons.find(s => (s.name || s.id) === selectedSeason || s.id === selectedSeason);
    return seasonMatch?.name || selectedSeason || '-';
  }, [seasons, selectedSeason]);

  const formatUsd = (value) => `$${parseFloat(value || 0).toFixed(2)}`;
  const formatUsdDeduction = (value) => `-$${parseFloat(value || 0).toFixed(2)}`;
  const formatTzs = (value) => parseFloat(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const formatTzsDeduction = (value) => `-${formatTzs(value)}`;

  const exportCSV = () => {
    const headers = ['Farmer #', 'Name', 'Society', 'Mass (kg)', 'Sales (USD)', ...inputColumns.map(c => `${c} (USD)`), 'USD Baki', 'Gross TZS', ...deductionColumns, 'NET TZS'];
    const body = rows.map(row => [
      row.farmer.farmerNumber || '',
      `${row.farmer.firstName || ''} ${row.farmer.lastName || ''}`.trim(),
      row.farmer.ps || '',
      row.mass.toFixed(2),
      formatUsd(row.sales),
      ...inputColumns.map(c => formatUsdDeduction(row.inputByType[c] || 0)),
      formatUsd(row.usdBaki),
      formatTzs(row.grossTzs),
      ...deductionColumns.map(c => formatTzsDeduction(row.deductionByName[c] || 0)),
      formatTzs(row.malipoHalisi)
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
            {seasons.map(s => <option key={s.id} value={s.name || s.id}>{s.name || s.id}</option>)}
          </select>
          <button onClick={exportCSV} className="px-3 py-2 border rounded-lg flex items-center gap-2 text-green-600 border-green-400">
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
            {[...new Set(farmers.map(f => f.ps).filter(Boolean))].map(ps => <option key={ps} value={ps}>{ps}</option>)}
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
            {[...new Set(farmers.map(f => f.ps).filter(Boolean))].map(ps => <option key={ps} value={ps}>{ps}</option>)}
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

      <div className="payment-print-only payment-print-title hidden mb-4 text-black">
        <h2 className="text-xl font-bold">Tobacco Sales - Payments Report</h2>
        <p className="text-sm mt-1">Season: {selectedSeasonLabel}</p>
      </div>

      <div className={`payment-print-table-wrap ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl overflow-x-auto`}>
        <table className="payment-print-table w-full text-xs min-w-[1100px]">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left bg-emerald-700 text-white font-semibold">Farmer #</th>
              <th className="px-3 py-2 text-left bg-emerald-700 text-white font-semibold">Name</th>
              <th className="px-3 py-2 text-left bg-emerald-700 text-white font-semibold">Society</th>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => (
              <tr key={row.farmer.id} className={darkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                <td className="px-3 py-2">{row.farmer.farmerNumber || '-'}</td>
                <td className="px-3 py-2">{`${row.farmer.firstName || ''} ${row.farmer.lastName || ''}`.trim()}</td>
                <td className="px-3 py-2">{row.farmer.ps}</td>
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
              </tr>
            ))}
            <tr className="bg-slate-900 text-white font-bold">
              <td className="px-3 py-2" colSpan={3}>TOTAL</td>
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
            </tr>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-gray-500" colSpan={8 + inputColumns.length + deductionColumns.length}>No farmer rows to display</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
