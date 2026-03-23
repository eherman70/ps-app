import { useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Edit, Trash2, X } from 'lucide-react';

function SaleNumberManagement() {
  const { darkMode } = useAppContext();
  const { items, loading, saveItem, deleteItem } = useStorage('salenumber');
  const { items: marketCenters } = useStorage('marketcenter');
  const { items: seasons } = useStorage('season');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ marketCenterId: '', saleNumber: '', seasonId: '', status: 'Active' });
  const [editing, setEditing] = useState(null);

  const handleSubmit = async () => {
    if (!form.marketCenterId || !form.saleNumber || !form.seasonId) {
      alert('Fill all required fields');
      return;
    }

    const mc = marketCenters.find(m => m.id === form.marketCenterId);
    const itemData = {
      ...form,
      marketCenterName: mc.name,
      createdAt: editing?.createdAt || new Date().toISOString()
    };
    if (editing) {
      itemData.id = editing.id;
    }
    await saveItem(editing?.id, itemData);
    resetForm();
  };

  const resetForm = () => {
    setForm({ marketCenterId: '', saleNumber: '', seasonId: '', status: 'Active' });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm({ marketCenterId: item.marketCenterId, saleNumber: item.saleNumber, seasonId: item.seasonId, status: item.status });
    setEditing(item);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete sale number?')) {
      await deleteItem(id);
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h4 className="text-lg font-semibold">Sale Number Management</h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
          <span>New Sale Number</span>
        </button>
      </div>

      <div className={`p-4 rounded-lg mb-6 ${darkMode ? 'bg-blue-900 text-blue-100' : 'bg-blue-50 text-blue-900'}`}>
        <p className="text-sm">Sale Numbers are linked to Market Centers. Each Market Center can have multiple Sale Numbers (e.g., Sale 1, Sale 2, Sale 3).</p>
      </div>

      {showForm && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-6`}>
          <div className="flex justify-between mb-4">
            <h5 className="font-semibold">{editing ? 'Edit' : 'New'} Sale Number</h5>
            <button onClick={resetForm}><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm">Market Center *</label>
              <select
                value={form.marketCenterId}
                onChange={(e) => setForm({...form, marketCenterId: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="">Select Market Center</option>
                {marketCenters.map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm">Sale Number *</label>
              <input
                type="text"
                value={form.saleNumber}
                onChange={(e) => setForm({...form, saleNumber: e.target.value})}
                placeholder="e.g., Sale 1"
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Active Season *</label>
              <select
                value={form.seasonId}
                onChange={(e) => setForm({...form, seasonId: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="">Select Season</option>
                {seasons?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Status *</label>
              <select
                value={form.status}
                onChange={(e) => setForm({...form, status: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-4 mt-6">
            <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 text-white rounded-lg">Save</button>
            <button onClick={resetForm} className={`px-6 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>Cancel</button>
          </div>
        </div>
      )}

      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-x-auto`}>
        <table className="w-full">
          <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Market Center</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-center">Sale Number</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Season</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-center">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium">{item.marketCenterName}</td>
                <td className="px-4 py-3 text-center font-bold tracking-wider">{item.saleNumber}</td>
                <td className="px-4 py-3">{item.seasonName}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${item.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="text-center py-8 text-gray-500">No sale numbers yet</div>}
      </div>
    </div>
  );
}

export default SaleNumberManagement;
