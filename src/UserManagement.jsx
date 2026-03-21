import { useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Edit, Trash2, X } from 'lucide-react';

function UserManagement() {
  const { darkMode, currentUser } = useAppContext();
  const { items, loading, saveItem, deleteItem } = useStorage('user');
  const { items: societies } = useStorage('ps');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'Capture Clerk', ps: '' });
  const [editing, setEditing] = useState(null);

  const handleSubmit = async () => {
    if (!form.username || !form.password || !form.fullName || !form.ps) {
      alert('Fill all fields');
      return;
    }

    // Ensure selected PS exists (pre-registered)
    const validPs = (societies || []).map(s => s.code);
    if (form.ps !== 'All' && !validPs.includes(form.ps)) {
      alert('Selected PS must be a registered society. Please register it first.');
      return;
    }

    await saveItem(form.username, { ...form, createdAt: editing?.createdAt || new Date().toISOString() });
    resetForm();
  };

  const resetForm = () => {
    setForm({ username: '', password: '', fullName: '', role: 'Capture Clerk', ps: '' });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(item);
    setShowForm(true);
  };

  const handleDelete = async (username) => {
    if (username === 'admin') {
      alert('Cannot delete admin');
      return;
    }
    if (confirm('Delete user?')) {
      await deleteItem(username);
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h3 className="text-xl font-semibold">Users</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
          <span>New User</span>
        </button>
      </div>

      {showForm && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-6`}>
          <div className="flex justify-between mb-4">
            <h4 className="font-semibold">{editing ? 'Edit' : 'New'} User</h4>
            <button onClick={resetForm}><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm">Username *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({...form, username: e.target.value})}
                disabled={editing}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm">Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({...form, password: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm">Full Name *</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({...form, fullName: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({...form, role: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option>Capture Clerk</option>
                <option>Supervisor</option>
                <option>Admin</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block mb-2 text-sm">Society / Grower Group *</label>
              <select
                value={form.ps}
                onChange={(e) => setForm({...form, ps: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="">-- Select Society --</option>
                <option value="All">All Societies (Admin Only)</option>
                {societies?.map(s => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
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
              <th className="px-4 py-3 text-left text-sm font-semibold">Username</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Full Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Society / Group</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(item => (
              <tr key={item.username}>
                <td className="px-4 py-3 font-medium">{item.username}</td>
                <td className="px-4 py-3">{item.fullName}</td>
                <td className="px-4 py-3">{item.role}</td>
                <td className="px-4 py-3">{item.ps}</td>
                <td className="px-4 py-3">
                  <div className="flex space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(item.username)} className="text-red-600" disabled={item.username === 'admin'}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="text-center py-8 text-gray-500">No users yet</div>}
      </div>
    </div>
  );
}

export default UserManagement;
