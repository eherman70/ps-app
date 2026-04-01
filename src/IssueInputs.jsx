import { useState, useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Trash2, X, ShoppingCart, User, Package } from 'lucide-react';
import { filterItemsByPS, getScopedPS } from './utils';

function IssueInputs() {
  const { darkMode, currentUser, testMode, activePS } = useAppContext();
  const { items, loading, saveItem, deleteItem } = useStorage('issuedinput');
  const { items: farmers } = useStorage('farmer');
  const { items: inputTypes } = useStorage('inputtype');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ farmerId: '', inputTypeId: '', quantity: '', totalValue: '' });

  const isSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';
  const activePSValue = getScopedPS(currentUser, activePS);

  // Filter farmers by active PS
  const filteredFarmers = filterItemsByPS(farmers, activePSValue);
  const filteredItems = filterItemsByPS(items, activePSValue);

  const handleInputType = (typeId) => {
    const type = inputTypes.find(t => t.id === typeId);
    if (type) {
      if (type.category === 'Cash Advance') {
        const val = parseFloat(form.totalValue) || 0;
        setForm({...form, inputTypeId: typeId, quantity: '', totalValue: val ? val.toString() : ''});
      } else {
        const qty = parseFloat(form.quantity) || 0;
        const total = type.unit === 'Fixed' ? parseFloat(type.unitPrice) : qty * parseFloat(type.unitPrice);
        setForm({...form, inputTypeId: typeId, totalValue: total.toFixed(2)});
      }
    }
  };

  const handleQty = (val) => {
    const type = inputTypes.find(t => t.id === form.inputTypeId);
    if (type) {
      const qty = parseFloat(val) || 0;
      const total = type.unit === 'Fixed' ? parseFloat(type.unitPrice) : qty * parseFloat(type.unitPrice);
      setForm({...form, quantity: val, totalValue: total.toFixed(2)});
    }
  };

  const handleAmountTzs = (val) => {
    setForm({...form, quantity: '', totalValue: val});
  };

  const selectedType = inputTypes.find(t => t.id === form.inputTypeId);
  const isCashAdvance = selectedType?.category === 'Cash Advance';

  const handleSubmit = async () => {
    if (!form.farmerId || !form.inputTypeId) {
      alert('Select farmer and input type');
      return;
    }

    const farmer = farmers.find(f => f.id === form.farmerId);
    const inputType = inputTypes.find(t => t.id === form.inputTypeId);

    if (!farmer || !inputType) return;

    const quantity = inputType.unit === 'Fixed' ? 1 : (parseFloat(form.quantity) || 0);
    if (quantity <= 0) {
      alert('Enter a valid quantity');
      return;
    }

    const totalCost = parseFloat(form.totalValue) || 0;
    const issueDate = new Date().toISOString().slice(0, 10);

    try {
      await saveItem(null, {
        ...form,
        quantity,
        isCashAdvance,
        farmerName: `${farmer.firstName} ${farmer.lastName}`,
        farmerNumber: farmer.farmerNumber,
        inputName: inputType.name,
        unitPrice: inputType.unitPrice,
        totalCost,
        ps: farmer.ps,
        testMode,
        issueDate,
        createdAt: new Date().toISOString()
      });
      alert('Input issued successfully');
      resetForm();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const resetForm = () => {
    setForm({ farmerId: '', inputTypeId: '', quantity: '', totalValue: '' });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this issued entry?')) {
      try {
        await deleteItem(id);
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h3 className="text-xl font-semibold">Issue Inputs & Advances</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow"
        >
          <Plus className="w-5 h-5" />
          <span>New Entry</span>
        </button>
      </div>

      {showForm && (
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl shadow-lg p-6 mb-8 border`}>
          <div className="flex justify-between mb-6">
            <h4 className="font-semibold text-lg">New Input Issue / Cash Advance</h4>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-500" /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block mb-2 text-sm font-medium">Farmer *</label>
              <select
                value={form.farmerId}
                onChange={(e) => setForm({...form, farmerId: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="">Select Farmer</option>
                {filteredFarmers.map(f => (
                  <option key={f.id} value={f.id}>{f.farmerNumber} - {f.firstName} {f.lastName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Input / Advance Type *</label>
              <select
                value={form.inputTypeId}
                onChange={(e) => handleInputType(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="">Select Type</option>
                {inputTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (${t.unitPrice}/{t.unit})</option>
                ))}
              </select>
            </div>

            {isCashAdvance ? (
              <div className="md:col-span-2">
                <label className="block mb-2 text-sm font-medium">Amount (TZS) *</label>
                <input
                  type="number"
                  step="1"
                  value={form.totalValue}
                  onChange={(e) => handleAmountTzs(e.target.value)}
                  placeholder="0"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block mb-2 text-sm font-medium">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.quantity}
                    onChange={(e) => handleQty(e.target.value)}
                    placeholder="0.00"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium">Total Value (USD)</label>
                  <div className={`w-full px-4 py-2 border rounded-lg font-bold ${darkMode ? 'bg-gray-900 border-gray-700 text-green-400' : 'bg-slate-50 border-gray-200 text-green-700'}`}>
                    ${form.totalValue || '0.00'}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex space-x-4 mt-8">
            <button onClick={handleSubmit} className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
              Issue Item
            </button>
            <button onClick={resetForm} className={`px-8 py-2 rounded-lg font-semibold ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow border ${darkMode ? 'border-gray-700' : 'border-gray-100'} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Farmer</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Item</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-center">Qty</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-right">Total Value</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredItems.map(item => (
              <tr key={item.id} className={darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50 transition'}>
                <td className="px-6 py-4 text-gray-500">
                  {new Date(item.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 opacity-50" />
                    <div className="flex flex-col">
                       <span className="font-bold">{item.farmerName}</span>
                       <span className="text-[10px] text-gray-500">{item.farmerNumber}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 opacity-50" />
                    {item.inputName}
                  </div>
                </td>
                <td className="px-6 py-4 text-center font-medium">
                  {item.isCashAdvance || item.inputName?.toLowerCase().includes('advance') || (inputTypes.find(t => t.id === item.inputTypeId)?.category === 'Cash Advance') ? '-' : (item.quantity || '-')}
                </td>
                <td className="px-6 py-4 text-right font-bold text-red-600 dark:text-red-400">
                   {item.isCashAdvance || item.inputName?.toLowerCase().includes('advance') || (inputTypes.find(t => t.id === item.inputTypeId)?.category === 'Cash Advance') 
                     ? `-${parseFloat(item.totalCost ?? item.totalValue ?? 0).toLocaleString()} TZS` 
                     : `-$${parseFloat(item.totalCost ?? item.totalValue ?? 0).toFixed(2)}`}
                </td>
                <td className="px-6 py-4 text-right text-gray-400">
                   <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-lg transition">
                      <Trash2 className="w-5 h-5" />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredItems.length === 0 && !loading && <div className="text-center py-12 text-gray-500 italic">No inputs have been issued yet</div>}
        {loading && <div className="text-center py-12 text-gray-500">Loading issue records...</div>}
      </div>
    </div>
  );
}

export default IssueInputs;
