import { useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Edit, Trash2, X, School } from 'lucide-react';

export default function PrimarySocietyManagement() {
  const { darkMode, currentUser } = useAppContext();
  const { items: societies, loading, saveItem, deleteItem } = useStorage('ps');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', status: 'Active' });
  const [editing, setEditing] = useState(null);

  const isSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';

  const handleSubmit = async () => {
    if (!form.name || !form.code) {
      alert('Name and code are required');
      return;
    }

    try {
      await saveItem(editing?.id, {
        ...form,
        createdAt: editing?.createdAt || new Date().toISOString(),
      });
      alert(editing ? 'Society updated' : 'Society registered');
      resetForm();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const resetForm = () => {
    setForm({ name: '', code: '', status: 'Active' });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(item);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this society? This may affect linked farmers and tickets.')) return;
    try {
      await deleteItem(id);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Only allow supervisors to manage societies
  if (!isSupervisor) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <School className="w-16 h-16 mb-4 opacity-20" />
        <p>Only Supervisors and Admins can manage primary societies.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h3 className="text-xl font-semibold">Primary Societies</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow"
        >
          <Plus className="w-5 h-5" />
          <span>New Society</span>
        </button>
      </div>

      {showForm && (
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl shadow-lg p-6 mb-8 border`}>
          <div className="flex justify-between mb-6">
            <h4 className="font-semibold text-lg">{editing ? 'Edit' : 'New'} Society Registration</h4>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-500" /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block mb-2 text-sm font-medium">Society Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="e.g. Ushetu Society"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Society Code *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})}
                disabled={Boolean(editing)}
                placeholder="e.g. USH01"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
              {editing && <p className="text-[10px] text-gray-500 mt-1">Code cannot be changed</p>}
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Status</label>
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
              {editing ? 'Update Society' : 'Save Society'}
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
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Code</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-center">Status</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {societies.map(item => (
              <tr key={item.id} className={darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50 transition'}>
                <td className="px-6 py-4 font-bold text-green-600 dark:text-green-400">{item.code}</td>
                <td className="px-6 py-4 font-medium">{item.name}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    item.status === 'Active' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-600 text-white shadow-sm'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-3">
                    <button onClick={() => handleEdit(item)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Edit">
                      <Edit className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Delete">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {societies.length === 0 && !loading && <div className="text-center py-12 text-gray-500 italic">No primary societies registered yet</div>}
        {loading && <div className="text-center py-12 text-gray-500">Loading societies...</div>}
      </div>
    </div>
  );
}
