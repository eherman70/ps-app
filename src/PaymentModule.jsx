import { useState, useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';

function PaymentModule() {
  const { darkMode, currentUser } = useAppContext();
  const { items: farmers } = useStorage('farmer');
  const { items: tickets } = useStorage('ticket');
  const { items: inputs } = useStorage('issuedinput');
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [exchangeRate, setExchangeRate] = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExchangeRate();
  }, []);

  const loadExchangeRate = async () => {
    try {
      const result = await window.storage.get('exchange_rate');
      if (result) {
        const data = JSON.parse(result.value);
        setExchangeRate(data.rate);
        setLocked(data.locked);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveExchangeRate = async () => {
    if (!exchangeRate) return alert('Enter exchange rate');
    await window.storage.set('exchange_rate', JSON.stringify({ rate: exchangeRate, locked: true }));
    setLocked(true);
    alert('Exchange rate locked');
  };

  const unlockExchangeRate = async () => {
    await window.storage.set('exchange_rate', JSON.stringify({ rate: exchangeRate, locked: false }));
    setLocked(false);
  };

  const calculatePayment = async (farmerId) => {
    setLoading(true);

    try {
      const farmer = farmers.find(f => f.id === farmerId);

      // Get all tickets for this farmer
      const farmerTickets = tickets.filter(t => t.farmerId === farmerId);
      const totalSales = farmerTickets.reduce((sum, t) => sum + parseFloat(t.value || 0), 0);

      // Get all inputs for this farmer
      const farmerInputs = inputs.filter(i => i.farmerId === farmerId);
      const totalInputs = farmerInputs.reduce((sum, i) => sum + parseFloat(i.totalValue || 0), 0);

      // Calculate payment
      const usdBalance = totalSales - totalInputs;
      const rate = parseFloat(exchangeRate) || 1;
      const tzsGross = usdBalance * rate;

      // TZS Deductions (example: 2% levy, 1% admin)
      const levy = tzsGross * 0.02;
      const admin = tzsGross * 0.01;
      const totalDeductions = levy + admin;
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
        admin,
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
    if (!paymentData) return;

    const id = `PAY${Date.now()}`;
    await window.storage.set(`payment_${id}`, JSON.stringify({
      ...paymentData,
      id,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.username
    }));

    alert('Payment saved successfully');
    setPaymentData(null);
    setSelectedFarmer(null);
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-6">Payment Processing</h3>

      {/* Exchange Rate Section */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-6`}>
        <h4 className="font-semibold mb-4">Exchange Rate (USD → TZS)</h4>
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block mb-2 text-sm">Exchange Rate *</label>
            <input
              type="number"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              disabled={locked}
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${locked ? 'opacity-50' : ''}`}
              placeholder="e.g., 2350"
            />
          </div>

          {!locked ? (
            <button
              onClick={saveExchangeRate}
              className="mt-7 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Lock Rate
            </button>
          ) : (
            <button
              onClick={unlockExchangeRate}
              className="mt-7 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              Unlock Rate
            </button>
          )}
        </div>
        {locked && <p className="text-sm text-green-600 mt-2">✓ Exchange rate is locked</p>}
      </div>

      {/* Farmer Selection */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-6`}>
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
              {farmers.map(f => (
                <option key={f.id} value={f.id}>
                  {f.farmerNumber} - {f.firstName} {f.lastName} ({f.village})
                </option>
              ))}
            </select>
          </div>
          {!locked && <p className="text-sm text-yellow-600">Lock exchange rate first</p>}
        </div>
      </div>

      {/* Payment Calculation */}
      {loading && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
          <p className="text-center">Calculating payment...</p>
        </div>
      )}

      {paymentData && !loading && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-semibold text-lg">Payment Summary</h4>
            <button
              onClick={savePayment}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Save Payment
            </button>
          </div>

          {/* Farmer Info */}
          <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <p className="font-semibold">{paymentData.farmer.farmerNumber} - {paymentData.farmer.firstName} {paymentData.farmer.lastName}</p>
            <p className="text-sm">{paymentData.farmer.village} | Phone: {paymentData.farmer.phoneNumber}</p>
          </div>

          {/* Sales Section */}
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
                      <td className="px-3 py-2">{t.mass}</td>
                      <td className="px-3 py-2">{t.saleNumber}</td>
                      <td className="px-3 py-2 text-right">${parseFloat(t.value).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan="4" className="px-3 py-2 text-right">Total Sales (MAUZO):</td>
                    <td className="px-3 py-2 text-right">${paymentData.totalSales.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Inputs Section */}
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
                      <td className="px-3 py-2">{new Date(i.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{i.inputName}</td>
                      <td className="px-3 py-2">{i.quantity || '-'}</td>
                      <td className="px-3 py-2 text-right">${parseFloat(i.totalValue).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan="3" className="px-3 py-2 text-right">Total Inputs:</td>
                    <td className="px-3 py-2 text-right">${paymentData.totalInputs.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Calculation */}
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
            <h5 className="font-semibold mb-4">Payment Calculation</h5>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Sales (MAUZO):</span>
                <span className="font-semibold">${paymentData.totalSales.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-red-600">
                <span>Less: Inputs & Cash Advances:</span>
                <span className="font-semibold">-${paymentData.totalInputs.toFixed(2)}</span>
              </div>

              <div className="border-t pt-2 flex justify-between">
                <span className="font-semibold">USD Balance (BAKI):</span>
                <span className="font-semibold text-lg">${paymentData.usdBalance.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span>Exchange Rate:</span>
                <span>1 USD = {paymentData.exchangeRate.toFixed(2)} TZS</span>
              </div>

              <div className="flex justify-between">
                <span>TZS Gross:</span>
                <span className="font-semibold">{paymentData.tzsGross.toFixed(2)} TZS</span>
              </div>

              <div className="flex justify-between text-red-600 text-sm">
                <span>Less: Levy (2%):</span>
                <span>-{paymentData.levy.toFixed(2)} TZS</span>
              </div>

              <div className="flex justify-between text-red-600 text-sm">
                <span>Less: Admin (1%):</span>
                <span>-{paymentData.admin.toFixed(2)} TZS</span>
              </div>

              <div className="border-t pt-2 flex justify-between">
                <span className="font-bold text-lg">Net Payment (MALIPO HALISI):</span>
                <span className="font-bold text-2xl text-green-600">{paymentData.tzsNet.toFixed(2)} TZS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!paymentData && !loading && locked && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 text-center text-gray-500`}>
          Select a farmer to calculate payment
        </div>
      )}
    </div>
  );
}

export default PaymentModule;
