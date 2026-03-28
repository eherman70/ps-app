import { useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Edit, Trash2, X, User } from 'lucide-react';

function UserManagement() {
  const { darkMode, currentUser } = useAppContext();
  // useStorage('user') maps to /api/users via main.jsx
  const { items: users, loading, saveItem, deleteItem, refreshItems } = useStorage('user');
  const { items: societies } = useStorage('ps');
  
  const [showForm, setShowForm] = useState(false);
  const isAdmin = currentUser.role === 'Admin';
  // Default new users PS to currently assigned PS for supervisors. Admin defaults to empty/none.
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'Clerk', ps: isAdmin ? '' : currentUser.ps });
  const [editing, setEditing] = useState(null);

  const isSupervisor = currentUser.role === 'Supervisor' || currentUser.role === 'Admin';

  const displayUsers = isAdmin ? users : users.filter(user => user.ps === currentUser.ps);

  const handleSubmit = async () => {
    if (!form.username || (!editing && !form.password) || !form.fullName || !form.ps) {
      alert('Fill all required fields');
      return;
    }

    // Ensure selected PS exists (pre-registered)
    const validPs = (societies || []).map(s => s.code);
    if (form.ps !== 'All' && !validPs.includes(form.ps)) {
      alert('Selected PS must be a registered society. Please register it first.');
      return;
    }

    try {
      // If editing, we use the UUID as the ID for useStorage/main.jsx mapping
      const id = editing ? editing.id : null;
      await saveItem(id, { 
        ...form, 
        createdAt: editing?.createdAt || new Date().toISOString() 
      });
      if (refreshItems) refreshItems();
      alert(editing ? 'User updated successfully' : 'User created successfully');
      resetForm();
    } catch (e) {
      alert('Error saving user: ' + e.message);
    }
  };

  const resetForm = () => {
    setForm({ username: '', password: '', fullName: '', role: 'Clerk', ps: isAdmin ? '' : currentUser.ps });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (user) => {
    setForm({
      username: user.username,
      password: '', // Don't show password, only fill if changing
      fullName: user.fullName,
      role: user.role,
      ps: user.ps
    });
    setEditing(user);
    setShowForm(true);
  };

  const handleDelete = async (user) => {
    if (user.username === 'admin') {
      alert('Cannot delete system administrator');
      return;
    }
    if (user.id === currentUser.id) {
      alert('Cannot delete your own account');
      return;
    }
    if (confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      try {
        await deleteItem(user.id);
        if (refreshItems) refreshItems();
      } catch (e) {
        alert('Error deleting user: ' + e.message);
      }
    }
  };

  const getPsName = (psCode) => {
    if (psCode === 'All') return 'All Societies (System Admin)';
    const ps = societies.find(s => s.code === psCode);
    return ps ? `${ps.name} (${ps.code})` : psCode;
  };

  if (!isSupervisor) {
    return (
      <div className="p-8 text-center text-gray-500">
        <User className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <h3 className="text-xl font-semibold">Access Denied</h3>
        <p>Only Supervisors and Admins can manage users.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h3 className="text-xl font-semibold">User Management</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow"
        >
          <Plus className="w-5 h-5" />
          <span>New User</span>
        </button>
      </div>

      {showForm && (
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl shadow-lg p-8 mb-8 border`}>
          <div className="flex justify-between mb-6">
            <h4 className="font-semibold text-lg">{editing ? 'Edit' : 'New'} User Account</h4>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-500" /></button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block mb-2 text-sm font-medium">Username *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({...form, username: e.target.value})}
                disabled={editing}
                placeholder="e.g. clerk1"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
              {editing && <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>}
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">{editing ? 'New Password (optional)' : 'Password *'}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({...form, password: e.target.value})}
                placeholder={editing ? "Leave blank to keep current" : "*******"}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Full Name *</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({...form, fullName: e.target.value})}
                placeholder="e.g. Juma Kassim"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({...form, role: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="Clerk">Clerk</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block mb-2 text-sm font-medium">Primary Society / Group *</label>
              <select
                value={form.ps}
                onChange={(e) => setForm({...form, ps: e.target.value})}
                disabled={!isAdmin}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!isAdmin ? 'bg-gray-100 cursor-not-allowed opacity-70' : ''}`}
              >
                <option value="">-- Select Society --</option>
                {isAdmin && <option value="All">All Societies (Full Access)</option>}
                {societies?.map(s => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          </div>

          <div className="flex space-x-4 mt-8">
            <button onClick={handleSubmit} className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
              {editing ? 'Update Account' : 'Create Account'}
            </button>
            <button onClick={resetForm} className={`px-8 py-2 rounded-lg font-semibold ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow overflow-hidden border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
        <table className="w-full text-sm">
          <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Username</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Full Name</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Primary Society</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {displayUsers.map(user => (
              <tr key={user.id} className={darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}>
                <td className="px-6 py-4 font-medium flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center font-bold">
                    {user.username[0].toUpperCase()}
                  </div>
                  {user.username}
                </td>
                <td className="px-6 py-4">{user.fullName}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    user.role === 'Admin' ? 'bg-purple-600 text-white' :
                    user.role === 'Supervisor' ? 'bg-blue-600 text-white' :
                    'bg-gray-600 text-white'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">{getPsName(user.ps)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-3">
                    <button onClick={() => handleEdit(user)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Edit User">
                      <Edit className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(user)} 
                      className={`p-2 rounded-lg transition ${user.username === 'admin' || user.id === currentUser.id ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`} 
                      disabled={user.username === 'admin' || user.id === currentUser.id}
                      title="Delete User"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {displayUsers.length === 0 && !loading && <div className="text-center py-12 text-gray-500">No user accounts found</div>}
        {loading && <div className="text-center py-12 text-gray-500">Loading user data...</div>}
      </div>
    </div>
  );
}

export default UserManagement;
