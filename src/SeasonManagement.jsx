import { useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Edit, Trash2, X, Calendar, Lock } from 'lucide-react';

function SeasonManagement() {
  const { darkMode, currentUser } = useAppContext();
  const { items, loading, saveItem, deleteItem, refreshItems } = useStorage('season');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [editing, setEditing] = useState(null);
  const [closingId, setClosingId] = useState(null);
  const [closeResult, setCloseResult] = useState(null);

  const isSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';
  const activeSeason = items.find(s => s.status === 'Active');

  const handleSubmit = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      alert('Fill all required fields');
      return;
    }

    try {
      // New seasons are always created as Active; editing preserves original status
      const itemData = {
        ...form,
        status: editing ? form.status : 'Active',
        createdAt: editing?.createdAt || new Date().toISOString()
      };
      await saveItem(editing?.id, itemData);
      alert(editing ? 'Season updated' : 'Season created successfully');
      resetForm();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const resetForm = () => {
    setForm({ name: '', startDate: '', endDate: '' });
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
    if (confirm('Are you sure you want to delete this season? This may affect linked farmers.')) {
      try {
        await deleteItem(id);
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
  };

  const handleCloseSeason = async (season) => {
    if (!confirm(
      `Close season "${season.name}"?\n\n` +
      `This will:\n` +
      `â€¢ Mark the season as Closed\n` +
      `â€¢ Calculate pending debts for each farmer\n` +
      `â€¢ Carry over any outstanding balances to the next season\n\n` +
      `This action cannot be undone. Proceed?`
    )) return;

    setClosingId(season.id);
    setCloseResult(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/seasons/${season.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to close season');
      setCloseResult(data);
      if (refreshItems) refreshItems();
    } catch (e) {
      alert('Error closing season: ' + e.message);
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h3 className="text-xl font-semibold">Tobacco Seasons</h3>
        {isSupervisor && (
          <button
            onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ name: '', startDate: '', endDate: '' }); }}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow"
          >
            <Plus className="w-5 h-5" />
            <span>New Season</span>
          </button>
        )}
      </div>

      {activeSeason && !showForm && (
        <div className={`mb-6 px-4 py-3 rounded-lg border text-sm font-medium flex items-center gap-2 ${darkMode ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-700'}`}>
          <Calendar className="w-4 h-4" />
          Active season: <span className="font-bold">{activeSeason.name}</span>
          &nbsp;â€” To open a new season, close this one first.
        </div>
      )}

      {showForm && isSupervisor && (
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl shadow-lg p-6 mb-8 border`}>
          <div className="flex justify-between mb-6">
            <h4 className="font-semibold text-lg">{editing ? 'Edit' : 'New'} Season</h4>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-500" /></button>
          </div>

          {!editing && activeSeason && (
            <div className={`mb-4 px-4 py-3 rounded-lg border text-sm ${darkMode ? 'bg-yellow-900/30 border-yellow-700 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
              âš  Season <strong>{activeSeason.name}</strong> is currently active. You must close it before creating a new one.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block mb-2 text-sm font-medium">Season Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="e.g. 2024/2025"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Start Date *</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({...form, startDate: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">End Date *</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({...form, endDate: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>
          </div>

          <div className="flex space-x-4 mt-8">
            <button
              onClick={handleSubmit}
              disabled={!editing && !!activeSeason}
              className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editing ? 'Update Season' : 'Create Season'}
            </button>
            <button onClick={resetForm} className={`px-8 py-2 rounded-lg font-semibold ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Close season result summary */}
      {closeResult && (
        <div className={`mb-6 rounded-xl border p-5 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-semibold text-green-600">Season Closed Successfully</h4>
            <button onClick={() => setCloseResult(null)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <p className="text-sm mb-3">{closeResult.message}</p>
          {closeResult.carryoverCount > 0 ? (
            <>
              <p className="text-sm font-medium mb-2">{closeResult.carryoverCount} farmer(s) with carried-over debt:</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                      <th className="text-left py-1 pr-4">Farmer #</th>
                      <th className="text-left py-1 pr-4">Name</th>
                      <th className="text-right py-1">Outstanding Debt (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closeResult.carryovers.map(c => (
                      <tr key={c.farmerId}>
                        <td className="py-1 pr-4 font-mono">{c.farmerNumber}</td>
                        <td className="py-1 pr-4">{c.farmerName}</td>
                        <td className="py-1 text-right text-red-500 font-semibold">{parseFloat(c.netDebt).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-green-600">All farmers fully settled â€” no debts to carry over.</p>
          )}
        </div>
      )}

      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow border ${darkMode ? 'border-gray-700' : 'border-gray-100'} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Season Name</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Duration</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-center">Status</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map(item => (
              <tr key={item.id} className={darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50 transition'}>
                <td className="px-6 py-4 font-bold text-green-600 dark:text-green-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 opacity-50" />
                    {item.name}
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-gray-600 dark:text-gray-300">
                   {new Date(item.startDate).toLocaleDateString()} â€” {new Date(item.endDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    item.status === 'Active' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-600 text-white shadow-sm'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-2">
                    {isSupervisor && item.status === 'Active' && (
                      <button
                        onClick={() => handleCloseSeason(item)}
                        disabled={closingId === item.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                        title="Close Season & carry over debts"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        {closingId === item.id ? 'Closing...' : 'Close Season'}
                      </button>
                    )}
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
        {items.length === 0 && !loading && <div className="text-center py-12 text-gray-500 italic">No tobacco seasons defined yet</div>}
        {loading && <div className="text-center py-12 text-gray-500">Loading seasons...</div>}
      </div>
    </div>
  );
}

export default SeasonManagement;
