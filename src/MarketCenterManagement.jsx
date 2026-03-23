import { useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Edit, Trash2, X, MapPin } from 'lucide-react';

function MarketCenterManagement() {
  const { darkMode, currentUser } = useAppContext();
  const { items, loading, saveItem, deleteItem } = useStorage('marketcenter');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', status: 'Active' });
  const [editing, setEditing] = useState(null);

  const isSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';

  const handleSubmit = async () => {
    if (!form.name) {
      alert('Enter market center name');
      return;
    }

    try {
      const itemData = { ...form, createdAt: editing?.createdAt || new Date().toISOString() };
      await saveItem(editing?.id, itemData);
      alert(editing ? 'Market center updated' : 'Market center registered');
      resetForm();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const resetForm = () => {
    setForm({ name: '', location: '', status: 'Active' });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(item);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!isSupervisor) return;
    if (confirm('Delete this market center? This may affect linked tickets and sale numbers.')) {
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
        <h3 className="text-xl font-semibold">Tobacoo Market Centers</h3>
        {isSupervisor && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow"
          >
            <Plus className="w-5 h-5" />
            <span>New Center</span>
          </button>
        )}
      </div>

      {showForm && isSupervisor && (
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl shadow-lg p-6 mb-8 border`}>
          <div className="flex justify-between mb-6">
            <h4 className="font-semibold text-lg">{editing ? 'Edit' : 'New'} Market Center</h4>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-500" /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block mb-2 text-sm font-medium">Center Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="e.g. Mwanza Market"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Location / Area</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({...form, location: e.target.value})}
                placeholder="Region, District"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Status *</label>
              <select
                value={form.status}
                onChange={(e) => setForm({...form, status: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-4 mt-8">
            <button onClick={handleSubmit} className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
              Save Center
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
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Market Center Name</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Location</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-center">Status</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map(item => (
              <tr key={item.id} className={darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50 transition'}>
                <td className="px-6 py-4 font-bold text-green-600 dark:text-green-400">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 opacity-50" />
                    {item.name}
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-gray-600 dark:text-gray-300">
                   {item.location || '-'}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    item.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-3">
                    {isSupervisor && (
                      <>
                        <button onClick={() => handleEdit(item)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Edit">
                          <Edit className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Delete">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && !loading && <div className="text-center py-12 text-gray-500 italic">No market centers defined yet</div>}
        {loading && <div className="text-center py-12 text-gray-500">Loading centers...</div>}
      </div>
    </div>
  );
}

export default MarketCenterManagement;
