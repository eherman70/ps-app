import { useState, useEffect, useRef } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Lock, Unlock, Printer, Download, DollarSign } from 'lucide-react';

function PaymentModule() {
  const { darkMode, currentUser } = useAppContext();
  const { items: farmers } = useStorage('farmer');
  const { items: tickets } = useStorage('ticket');
  const { items: inputs } = useStorage('issuedinput');
  const { items: payments, refreshItems: refreshPayments } = useStorage('payment');

  const isSupervisor = currentUser.role === 'Supervisor' || currentUser.role === 'Admin';

  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [exchangeRate, setExchangeRate] = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('calculate'); // 'calculate' | 'history'

  const printRef = useRef(null);

  useEffect(() => {
    loadExchangeRate();
  }, []);

  const loadExchangeRate = async () => {
    try {
      const data = await window.api.request('/exchange-rate');
      if (data && data.rate) {
        setExchangeRate(String(data.rate));
        setLocked(Boolean(data.locked));
      }
    } catch (e) {
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('exchange_rate');
        if (stored) {
          const d = JSON.parse(stored);
          setExchangeRate(String(d.rate || ''));
          setLocked(Boolean(d.locked));
        }
      } catch {}
    }
  };

  const saveExchangeRate = async (lock) => {
    if (!exchangeRate) return alert('Enter exchange rate');
    if (!isSupervisor) return alert('Only Supervisors can lock the exchange rate');
    try {
      await window.api.request('/exchange-rate', {
        method: 'POST',
        body: JSON.stringify({ rate: parseFloat(exchangeRate), locked: lock })
      });
      setLocked(lock);
      if (lock) alert('Exchange rate locked successfully');
    } catch (e) {
      // Fallback to localStorage
      localStorage.setItem('exchange_rate', JSON.stringify({ rate: exchangeRate, locked: lock }));
      setLocked(lock);
    }
  };

  const calculatePayment = async (farmerId) => {
    if (!farmerId) { setPaymentData(null); setSelectedFarmer(null); return; }
    setLoading(true);
    try {
      const farmer = farmers.find(f => f.id === farmerId);

      // Tickets for this farmer
      const farmerTickets = tickets.filter(t => t.farmerId === farmerId);
      const totalSales = farmerTickets.reduce((sum, t) => sum + parseFloat(t.value || t.totalValue || 0), 0);

      // Inputs for this farmer — handle both totalCost and totalValue field names
      const farmerInputs = inputs.filter(i => i.farmerId === farmerId);
      const totalInputs = farmerInputs.reduce((sum, i) => sum + parseFloat(i.totalCost || i.totalValue || 0), 0);

      const usdBalance = totalSales - totalInputs;
      const rate = parseFloat(exchangeRate) || 1;
      const tzsGross = usdBalance * rate;

      // TZS Deductions
      const levy = tzsGross * 0.02;      // 2% levy
      const adminFee = tzsGross * 0.01;  // 1% admin
      const totalDeductions = levy + adminFee;
      const tzsNet = tzsGross - totalDeductions;

      setPaymentData({
        farmer,
        tickets: farmerTickets,
        inputs: farmerInputs,
        totalSales,
        totalInputs,
        usdBalance,
        exchangeRate: rate,
        tzsGross,
        levy,
        adminFee,
        totalDeductions,
        tzsNet
      });
      setSelectedFarmer(farmerId);
    } catch (e) {
      console.error('Payment calculation error:', e);
      alert('Error calculating payment');
    }
    setLoading(false);
  };

  const savePayment = async () => {
    if (!paymentData || !isSupervisor) return;
    setSaving(true);
    try {
      await window.api.create('payments', {
        farmerId: paymentData.farmer.id,
        pcnId: null,
        tobaccoAmount: paymentData.totalSales,
        inputDeduction: paymentData.totalInputs,
        usdBalance: paymentData.usdBalance,
        exchangeRate: paymentData.exchangeRate,
        tzsGross: paymentData.tzsGross,
        levy: paymentData.levy,
        adminFee: paymentData.adminFee,
        totalDeductions: paymentData.totalDeductions,
        netPayment: paymentData.tzsNet,
        paymentDate: new Date().toISOString().slice(0, 10),
        ps: paymentData.farmer.ps
      });
      if (refreshPayments) refreshPayments();
      alert('Payment saved successfully');
      setPaymentData(null);
      setSelectedFarmer(null);
    } catch (e) {
      alert('Error saving payment: ' + e.message);
    }
    setSaving(false);
  };

  const printSlip = () => {
    window.print();
  };

  const exportPaymentsCSV = () => {
    const psFilter = isSupervisor ? 'All' : currentUser.ps;
    const data = psFilter === 'All' ? payments : payments.filter(p => p.ps === psFilter);

    const headers = ['Date', 'Farmer #', 'Farmer Name', 'Village', 'Phone', 'MAUZO (USD)', 'Inputs (USD)', 'USD BAKI', 'Rate', 'TZS Gross', 'Levy (2%)', 'Admin (1%)', 'MALIPO HALISI (TZS)', 'PS'];
    const rows = data.map(p => [
      p.paymentDate,
      p.farmerNumber || '',
      `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      p.village || '',
      p.phoneNumber || '',
      parseFloat(p.tobaccoAmount || 0).toFixed(2),
      parseFloat(p.inputDeduction || 0).toFixed(2),
      parseFloat(p.usdBalance || 0).toFixed(2),
      parseFloat(p.exchangeRate || 0).toFixed(2),
      parseFloat(p.tzsGross || 0).toFixed(2),
      parseFloat(p.levy || 0).toFixed(2),
      parseFloat(p.adminFee || 0).toFixed(2),
      parseFloat(p.netPayment || 0).toFixed(2),
      p.ps || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers, ...rows].map(row => row.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Payment_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cardClass = `${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-6`;

  const psFilteredFarmers = isSupervisor
    ? farmers
    : farmers.filter(f => f.ps === currentUser.ps);

  return (
    <div>
      <h3 className="text-xl font-semibold mb-6">Payment Processing</h3>

      {/* Tab Navigation */}
      <div className={`flex border-b mb-6 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        {['calculate', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium capitalize ${activeTab === tab ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`}>
            {tab === 'calculate' ? 'Calculate Payment' : 'Payment History'}
          </button>
        ))}
      </div>

      {activeTab === 'history' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold">Payment History</h4>
            <button onClick={exportPaymentsCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Download className="w-4 h-4" /> Export Excel/CSV
            </button>
          </div>
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Farmer</th>
                  <th className="px-4 py-3 text-right">MAUZO (USD)</th>
                  <th className="px-4 py-3 text-right">Inputs (USD)</th>
                  <th className="px-4 py-3 text-right">USD BAKI</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right font-bold">MALIPO HALISI (TZS)</th>
                  <th className="px-4 py-3 text-left">PS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {payments.filter(p => isSupervisor || p.ps === currentUser.ps).map(p => (
                  <tr key={p.id} className={darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">{p.paymentDate}</td>
                    <td className="px-4 py-3">{p.farmerNumber} - {p.firstName} {p.lastName}</td>
                    <td className="px-4 py-3 text-right">${parseFloat(p.tobaccoAmount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-red-500">-${parseFloat(p.inputDeduction || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">${parseFloat(p.usdBalance || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{parseFloat(p.exchangeRate || 0).toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{parseFloat(p.netPayment || 0).toLocaleString()} TZS</td>
                    <td className="px-4 py-3">{p.ps}</td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-500">No payment records yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'calculate' && (
        <>
          {/* Exchange Rate Section */}
          <div className={cardClass}>
            <h4 className="font-semibold mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" /> Exchange Rate (USD → TZS)</h4>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label className="block mb-2 text-sm">Rate (TZS per 1 USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  disabled={locked}
                  className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${locked ? 'opacity-50' : ''}`}
                  placeholder="e.g., 2650"
                />
              </div>
              {isSupervisor && (
                !locked ? (
                  <button onClick={() => saveExchangeRate(true)}
                    className="mt-7 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Lock Rate
                  </button>
                ) : (
                  <button onClick={() => saveExchangeRate(false)}
                    className="mt-7 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2">
                    <Unlock className="w-4 h-4" /> Unlock Rate
                  </button>
                )
              )}
            </div>
            {locked && <p className="text-sm text-green-600 mt-2">✓ Exchange rate is locked at {parseFloat(exchangeRate).toLocaleString()} TZS/USD</p>}
            {!locked && !isSupervisor && <p className="text-sm text-yellow-600 mt-2">⚠ Exchange rate must be locked by a Supervisor before payment</p>}
          </div>

          {/* Farmer Selection */}
          <div className={cardClass}>
            <h4 className="font-semibold mb-4">Select Farmer for Payment</h4>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <select
                  value={selectedFarmer || ''}
                  onChange={(e) => calculatePayment(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                  disabled={!locked}
                >
                  <option value="">Select Farmer</option>
                  {psFilteredFarmers.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.farmerNumber} - {f.firstName} {f.lastName} ({f.village})
                    </option>
                  ))}
                </select>
              </div>
              {!locked && <p className="text-sm text-yellow-600">Lock exchange rate first</p>}
            </div>
          </div>

          {loading && (
            <div className={cardClass}><p className="text-center">Calculating payment...</p></div>
          )}

          {paymentData && !loading && (
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`} ref={printRef}>
              {/* Print Header - only shown on print */}
              <div className="hidden print:block p-8 border-b-2 border-black mb-4 text-center">
                <h1 className="text-2xl font-bold uppercase">PRIMARY SOCIETY — PAYMENT SLIP</h1>
                <p className="text-sm mt-1">Date: {new Date().toLocaleDateString()} | PS: {paymentData.farmer.ps}</p>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-semibold text-lg">Payment Summary</h4>
                  <div className="flex gap-3 print:hidden">
                    {isSupervisor && (
                      <button onClick={savePayment} disabled={saving}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save Payment'}
                      </button>
                    )}
                    <button onClick={printSlip}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                      <Printer className="w-4 h-4" /> Print Slip
                    </button>
                  </div>
                </div>

                {/* Farmer Info */}
                <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <p className="font-semibold text-lg">{paymentData.farmer.farmerNumber} — {paymentData.farmer.firstName} {paymentData.farmer.middleName || ''} {paymentData.farmer.lastName}</p>
                  <div className="grid grid-cols-3 gap-2 text-sm mt-1 text-gray-500">
                    <span>Village: {paymentData.farmer.village}</span>
                    <span>Phone: {paymentData.farmer.phoneNumber || 'N/A'}</span>
                    <span>PS: {paymentData.farmer.ps}</span>
                  </div>
                </div>

                {/* Sales Table */}
                <div className="mb-6">
                  <h5 className="font-semibold mb-2">Tobacco Sales (USD)</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-100'}>
                        <tr>
                          <th className="px-3 py-2 text-left">Ticket #</th>
                          <th className="px-3 py-2 text-left">Grade</th>
                          <th className="px-3 py-2 text-left">Mass (Kg)</th>
                          <th className="px-3 py-2 text-left">Sale #</th>
                          <th className="px-3 py-2 text-right">Value (USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paymentData.tickets.map(t => (
                          <tr key={t.id}>
                            <td className="px-3 py-2">{t.ticketNumber}</td>
                            <td className="px-3 py-2">{t.gradeName}</td>
                            <td className="px-3 py-2">{t.mass || t.netWeight}</td>
                            <td className="px-3 py-2">{t.saleNumber}</td>
                            <td className="px-3 py-2 text-right">${parseFloat(t.value || t.totalValue || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold border-t-2">
                          <td colSpan="4" className="px-3 py-2 text-right">Total (MAUZO):</td>
                          <td className="px-3 py-2 text-right">${paymentData.totalSales.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Inputs Table */}
                <div className="mb-6">
                  <h5 className="font-semibold mb-2">Inputs & Cash Advances (USD)</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-100'}>
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Input</th>
                          <th className="px-3 py-2 text-left">Quantity</th>
                          <th className="px-3 py-2 text-right">Value (USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paymentData.inputs.map(i => (
                          <tr key={i.id}>
                            <td className="px-3 py-2">{new Date(i.issueDate || i.createdAt).toLocaleDateString()}</td>
                            <td className="px-3 py-2">{i.inputName || i.name}</td>
                            <td className="px-3 py-2">{i.quantity || '-'}</td>
                            <td className="px-3 py-2 text-right">${parseFloat(i.totalCost || i.totalValue || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                        {paymentData.inputs.length === 0 && (
                          <tr><td colSpan="4" className="px-3 py-2 text-center text-gray-500">No inputs recorded</td></tr>
                        )}
                        <tr className="font-semibold border-t-2">
                          <td colSpan="3" className="px-3 py-2 text-right">Total Inputs:</td>
                          <td className="px-3 py-2 text-right">${paymentData.totalInputs.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Calculation Summary */}
                <div className={`p-6 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-blue-50'} border ${darkMode ? 'border-gray-600' : 'border-blue-200'}`}>
                  <h5 className="font-semibold mb-4 text-base">Payment Calculation</h5>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Total Tobacco Sales (MAUZO):</span>
                      <span className="font-semibold">${paymentData.totalSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Less: Inputs & Cash Advances:</span>
                      <span className="font-semibold">-${paymentData.totalInputs.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>USD Balance (BAKI):</span>
                      <span className="text-lg">${paymentData.usdBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Exchange Rate:</span>
                      <span>1 USD = {paymentData.exchangeRate.toLocaleString()} TZS</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>TZS Gross:</span>
                      <span className="font-semibold">{paymentData.tzsGross.toLocaleString(undefined, {maximumFractionDigits: 2})} TZS</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Less: Levy (2%):</span>
                      <span>-{paymentData.levy.toLocaleString(undefined, {maximumFractionDigits: 2})} TZS</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Less: Admin Fee (1%):</span>
                      <span>-{paymentData.adminFee.toLocaleString(undefined, {maximumFractionDigits: 2})} TZS</span>
                    </div>
                    <div className="border-t-2 pt-3 flex justify-between items-center">
                      <span className="font-bold text-lg">Net Payment (MALIPO HALISI):</span>
                      <span className="font-bold text-2xl text-green-600">{paymentData.tzsNet.toLocaleString(undefined, {maximumFractionDigits: 2})} TZS</span>
                    </div>
                  </div>
                </div>

                {/* Print footer */}
                <div className="hidden print:block mt-8 pt-6 border-t grid grid-cols-2 gap-8 text-sm">
                  <div>
                    <p className="font-semibold mb-6">Farmer Signature:</p>
                    <div className="border-b border-black w-48"></div>
                  </div>
                  <div>
                    <p className="font-semibold mb-6">Authorized By:</p>
                    <div className="border-b border-black w-48"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!paymentData && !loading && locked && (
            <div className={`${cardClass} text-center text-gray-500`}>
              Select a farmer above to calculate their payment
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PaymentModule;
