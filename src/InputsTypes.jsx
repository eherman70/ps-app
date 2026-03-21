import { useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Edit, Trash2, X } from 'lucide-react';

function InputTypes() {
  const { darkMode } = useAppContext();
  const { items, loading, saveItem, deleteItem } = useStorage('inputtype');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Fertilizer', unitPrice: '', unit: 'Kg', status: 'Active' });
  const [editing, setEditing] = useState(null);

  const handleSubmit = async () => {
    if (!form.name || !form.unitPrice) {
      alert('Fill required fields');
      return;
    }

    const itemData = { ...form, createdAt: editing?.createdAt || new Date().toISOString() };
    if (editing) {
      itemData.id = editing.id;
    }
    await saveItem(editing?.id, itemData);
    resetForm();
  };

  const resetForm = () => {
    setForm({ name: '', category: 'Fertilizer', unitPrice: '', unit: 'Kg', status: 'Active' });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(item);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete input type?')) {
      await deleteItem(id);
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h3 className="text-xl font-semibold">Input Types</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
          <span>New Type</span>
        </button>
      </div>

      {showForm && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-6`}>
          <div className="flex justify-between mb-4">
            <h4 className="font-semibold">{editing ? 'Edit' : 'New'} Input Type</h4>
            <button onClick={resetForm}><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="NPK, CAN"
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({...form, category: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option>Fertilizer</option>
                <option>Pesticide</option>
                <option>Seed</option>
                <option>Cash Advance</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm">Price (USD) *</label>
              <input
                type="number"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm({...form, unitPrice: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm">Unit *</label>
              <select
                value={form.unit}
                onChange={(e) => setForm({...form, unit: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option>Kg</option>
                <option>Liter</option>
                <option>Bag</option>
                <option>Fixed</option>
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
              <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Price</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Unit</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">{item.category}</td>
                <td className="px-4 py-3">${parseFloat(item.unitPrice).toFixed(2)}</td>
                <td className="px-4 py-3">{item.unit}</td>
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
        {items.length === 0 && <div className="text-center py-8 text-gray-500">No input types yet</div>}
      </div>
    </div>
  );
}

export default InputTypes;
