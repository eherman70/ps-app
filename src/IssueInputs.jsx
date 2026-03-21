import { useState, useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, X } from 'lucide-react';

function IssueInputs() {
  const { darkMode, currentUser, testMode } = useAppContext();
  const { items, loading, saveItem, deleteItem } = useStorage('issuedinput');
  const { items: farmers } = useStorage('farmer');
  const { items: inputTypes } = useStorage('inputtype');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ farmerId: '', inputTypeId: '', quantity: '', totalValue: '' });

  const handleInputType = (typeId) => {
    const type = inputTypes.find(t => t.id === typeId);
    if (type) {
      const qty = parseFloat(form.quantity) || 0;
      const total = type.unit === 'Fixed' ? parseFloat(type.unitPrice) : qty * parseFloat(type.unitPrice);
      setForm({...form, inputTypeId: typeId, totalValue: total.toFixed(2)});
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

  const handleSubmit = async () => {
    if (!form.farmerId || !form.inputTypeId) {
      alert('Select farmer and input type');
      return;
    }

    const farmer = farmers.find(f => f.id === form.farmerId);
    const inputType = inputTypes.find(t => t.id === form.inputTypeId);

    const id = `II${Date.now()}`;
    await saveItem(id, {
      ...form,
      id,
      farmerName: `${farmer.firstName} ${farmer.lastName}`,
      farmerNumber: farmer.farmerNumber,
      inputName: inputType.name,
      unitPrice: inputType.unitPrice,
      ps: farmer.ps,
      testMode,
      createdAt: new Date().toISOString()
    });
    resetForm();
  };

  const resetForm = () => {
    setForm({ farmerId: '', inputTypeId: '', quantity: '', totalValue: '' });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete?')) {
      await deleteItem(id);
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h3 className="text-xl font-semibold">Issue Inputs</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
          <span>Issue</span>
        </button>
      </div>

      {showForm && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-6`}>
          <div className="flex justify-between mb-4">
            <h4 className="font-semibold">Issue Input</h4>
            <button onClick={resetForm}><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm">Farmer *</label>
              <select
                value={form.farmerId}
                onChange={(e) => setForm({...form, farmerId: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="">Select</option>
                {farmers.map(f => (
                  <option key={f.id} value={f.id}>{f.farmerNumber} - {f.firstName} {f.lastName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm">Input Type *</label>
              <select
                value={form.inputTypeId}
                onChange={(e) => handleInputType(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="">Select</option>
                {inputTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} - ${t.unitPrice}/{t.unit}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm">Quantity</label>
              <input
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => handleQty(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm">Total (USD)</label>
              <input
                type="number"
                value={form.totalValue}
                readOnly
                className={`w-full px-3 py-2 border rounded-lg bg-gray-100 ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>
          </div>

          <div className="flex space-x-4 mt-6">
            <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 text-white rounded-lg">Issue</button>
            <button onClick={resetForm} className={`px-6 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>Cancel</button>
          </div>
        </div>
      )}

      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-x-auto`}>
        <table className="w-full">
          <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Farmer</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Input</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Qty</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Total (USD)</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">{new Date(item.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">{item.farmerName}</td>
                <td className="px-4 py-3">{item.inputName}</td>
                <td className="px-4 py-3">{item.quantity || '-'}</td>
                <td className="px-4 py-3 font-medium">${parseFloat(item.totalValue).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(item.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="text-center py-8 text-gray-500">No inputs issued yet</div>}
      </div>
    </div>
  );
}

export default IssueInputs;
