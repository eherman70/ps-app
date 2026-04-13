import { useState, useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Edit, Trash2, X, Search, Upload, FileDown } from 'lucide-react';
import { parseCSV, generateCSV, downloadCSV, filterItemsByPS, getScopedPS } from './utils';

function FarmerManagement() {
  const { darkMode, currentUser, activePS, testMode } = useAppContext();
  const { items: farmers, loading, saveItem, deleteItem } = useStorage('farmer');
  const { items: seasons } = useStorage('season');
  const { items: societies } = useStorage('ps');

  const isSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';
  const activePSValue = getScopedPS(currentUser, activePS);

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [volumeOverride, setVolumeOverride] = useState(false);
  const [form, setForm] = useState({
    farmerNumber: '', firstName: '', middleName: '', lastName: '', gender: 'Male', age: '',
    phoneNumber: '', idType: 'Voter ID', idNumber: '', village: '',
    hectares: '', contractedVolume: '', seasonId: '', status: 'Active', ps: activePSValue === 'All' ? '' : activePSValue
  });
  const [editing, setEditing] = useState(null);

  const handleSubmit = async () => {
    if (!form.farmerNumber || !form.firstName || !form.lastName || !form.seasonId || !form.ps) {
      alert('Fill required fields: Farmer Number, First Name, Last Name, Season, PS');
      return;
    }

    const itemData = {
      ...form,
      testMode,
      createdAt: editing?.createdAt || new Date().toISOString()
    };
    if (editing) {
      itemData.id = editing.id;
    }
    try {
      await saveItem(editing?.id, itemData);
      resetForm();
    } catch (err) {
      alert(err.message || 'Failed to save farmer. Please try again.');
    }
  };

  const resetForm = () => {
    setForm({
      farmerNumber: '', firstName: '', middleName: '', lastName: '', gender: 'Male', age: '',
      phoneNumber: '', idType: 'Voter ID', idNumber: '', village: '',
      hectares: '', contractedVolume: '', seasonId: '', status: 'Active', ps: activePSValue === 'All' ? '' : activePSValue
    });
    setVolumeOverride(false);
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(item);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete farmer?')) {
      await deleteItem(id);
    }
  };

  const downloadTemplate = () => {
    const headers = ['farmerNumber', 'firstName', 'lastName', 'middleName', 'gender', 'age', 'phoneNumber', 'village', 'hectares', 'seasonName', 'ps', 'idType', 'idNumber'];
    const sample = [['TTB/KHM/200/012', 'John', 'Doe', 'K', 'Male', '45', '0712345678', 'Ushetu', '2.5', seasons[0]?.name || 'Season 2024', currentUser.ps === 'All' ? 'DEFAULT' : currentUser.ps, 'Voter ID', 'V-123456']];
    const csv = generateCSV([headers, ...sample]);
    downloadCSV('farmer_import_template.csv', csv);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = parseCSV(text);
      if (rows.length < 2) return alert('Invalid CSV format');

      const headers = rows[0];
      const data = rows.slice(1);

      const counterResult = await window.storage.get('counter_farmer');
      let counter = parseInt(counterResult?.value || '1000');

      let importedCount = 0;
      let errorCount = 0;

      for (const row of data) {
        if (row.length < 2) continue; // Skip empty rows

        const rowData = {};
        headers.forEach((h, i) => {
          rowData[h.trim()] = row[i];
        });

        // Validation & Mapping
        if (!rowData.farmerNumber || !rowData.firstName || !rowData.lastName || !rowData.village || !rowData.seasonName) {
          errorCount++;
          continue;
        }

        const season = seasons.find(s => s.name === rowData.seasonName);
        if (!season) {
          errorCount++;
          continue;
        }

        const ha = parseFloat(rowData.hectares) || 0;
        const farmerNumber = rowData.farmerNumber.trim();

        const farmerData = {
          firstName: rowData.firstName,
          middleName: rowData.middleName || '',
          lastName: rowData.lastName,
          gender: rowData.gender || 'Male',
          age: rowData.age || '',
          phoneNumber: rowData.phoneNumber || '',
          village: rowData.village,
          hectares: rowData.hectares || '0',
          contractedVolume: (ha * 1400).toString(),
          seasonId: season.id,
          ps: rowData.ps || (currentUser.ps === 'All' ? '' : currentUser.ps),
          idType: rowData.idType || 'Voter ID',
          idNumber: rowData.idNumber || '',
          status: 'Active',
          farmerNumber,
          testMode,
          createdAt: new Date().toISOString()
        };

        try {
          await saveItem(null, farmerData);
          importedCount++;
        } catch (err) {
          errorCount++;
        }
      }

      alert(`Import complete! Successfully imported: ${importedCount}, Errors: ${errorCount}`);
      // Clear file input
      e.target.value = null;
    };
    reader.readAsText(file);
  };

  const handleHectares = (val) => {
    const ha = parseFloat(val) || 0;
    // Only auto-calc if not in manual override mode
    if (!volumeOverride) {
      setForm({ ...form, hectares: val, contractedVolume: (ha * 1400).toString() });
    } else {
      setForm({ ...form, hectares: val });
    }
  };

  const handleKeyDown = (e, nextFieldId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextFieldId === 'submit') {
        handleSubmit();
      } else {
        document.getElementById(nextFieldId)?.focus();
      }
    }
  };

  const filteredFarmers = filterItemsByPS(farmers, activePSValue)
    .filter(f =>
      (f.firstName || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.lastName || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.farmerNumber || '').toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h3 className="text-xl font-semibold">Farmers</h3>
        <div className="flex space-x-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            title="Download Import Template"
          >
            <FileDown className="w-5 h-5" />
            <span className="hidden md:inline">Template</span>
          </button>
          <label className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer">
            <Upload className="w-5 h-5" />
            <span className="hidden md:inline">Import</span>
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>New Farmer</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-6`}>
          <div className="flex justify-between mb-4">
            <h4 className="font-semibold">{editing ? 'Edit' : 'New'} Farmer</h4>
            <button onClick={resetForm}><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3 md:col-span-1">
              <label className="block mb-2 text-sm font-semibold">Farmer Number * <span className="font-normal text-gray-400">(e.g. TTB/___/200/012)</span></label>
              <input
                id="fm-farmernumber"
                type="text"
                placeholder="e.g. TTB/KHM/200/012"
                value={form.farmerNumber}
                onChange={(e) => setForm({ ...form, farmerNumber: e.target.value.toUpperCase() })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-fname')}
                className={`w-full px-3 py-2 border-2 rounded-lg font-mono tracking-wide ${darkMode ? 'bg-gray-700 border-yellow-500 text-yellow-300 placeholder-gray-500' : 'border-yellow-400 bg-yellow-50 text-gray-800 placeholder-gray-400'}`}
              />
            </div>
            <div>
              <label className="block mb-2 text-sm">First Name *</label>
              <input
                id="fm-fname"
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-mname')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>
            <div>
              <label className="block mb-2 text-sm">Middle Name</label>
              <input
                id="fm-mname"
                type="text"
                value={form.middleName}
                onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-lname')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>
            <div>
              <label className="block mb-2 text-sm">Last Name *</label>
              <input
                id="fm-lname"
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-gender')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm">Gender *</label>
              <select
                id="fm-gender"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-age')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm">Age *</label>
              <input
                id="fm-age"
                type="number"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-village')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>
            <div>
              <label className="block mb-2 text-sm">Village *</label>
              <input
                id="fm-village"
                type="text"
                value={form.village}
                onChange={(e) => setForm({ ...form, village: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-hectares')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm">Hectares *</label>
              <input
                id="fm-hectares"
                type="number"
                step="0.01"
                value={form.hectares}
                onChange={(e) => handleHectares(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'fm-season')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm">Volume (Kg)</label>
                {isSupervisor && (
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={volumeOverride} onChange={e => setVolumeOverride(e.target.checked)} className="rounded" />
                    Manual override
                  </label>
                )}
              </div>
              <input
                type="number"
                value={form.contractedVolume}
                onChange={(e) => setForm({ ...form, contractedVolume: e.target.value })}
                readOnly={!volumeOverride}
                className={`w-full px-3 py-2 border rounded-lg ${volumeOverride ? '' : 'bg-gray-100'} ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
              <p className="text-xs mt-1">{volumeOverride ? '⚠ Manual mode — auto-calc disabled' : 'Auto: 1 Ha = 1,400 Kg'}</p>
            </div>

            <div>
              <label className="block mb-2 text-sm">Season *</label>
              <select
                id="fm-season"
                value={form.seasonId}
                onChange={(e) => setForm({ ...form, seasonId: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-phone')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="">Select Season</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm">Phone</label>
              <input
                id="fm-phone"
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-idtype')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm">ID Type</label>
              <select
                id="fm-idtype"
                value={form.idType}
                onChange={(e) => setForm({ ...form, idType: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-idnumber')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option>Voter ID</option>
                <option>NIDA</option>
                <option>Driving License</option>
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm">ID Number</label>
              <input
                id="fm-idnumber"
                type="text"
                value={form.idNumber}
                onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'fm-status')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm">Status *</label>
              <select
                id="fm-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'submit')}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm">Primary Society *</label>
              {currentUser.ps === 'All' ? (
                <select
                  value={form.ps}
                  onChange={(e) => setForm({ ...form, ps: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                >
                  <option value="">-- Select Society --</option>
                  {societies.filter(s => s.status === 'Active').map(s => (
                    <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>
              ) : (
                <div className={`w-full px-3 py-2 border rounded-lg flex items-center gap-2 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'
                  }`}>
                  <span className="px-2 py-0.5 rounded-full bg-green-600 text-white text-xs font-bold">{form.ps}</span>
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {societies.find(s => s.code === form.ps)?.name || form.ps}
                  </span>
                  <span className={`ml-auto text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Auto-assigned</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-4 mt-6">
            <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 text-white rounded-lg">Save</button>
            <button onClick={resetForm} className={`px-6 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>Cancel</button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search farmers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`flex-1 px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
          />
        </div>
      </div>

      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-x-auto`}>
        <table className="w-full">
          <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Farmer #</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Phone</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Village</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Ha</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Season</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredFarmers.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.farmerNumber}</td>
                <td className="px-4 py-3">{item.firstName} {item.lastName}</td>
                <td className="px-4 py-3">{item.phoneNumber}</td>
                <td className="px-4 py-3">{item.village}</td>
                <td className="px-4 py-3">{item.hectares}</td>
                <td className="px-4 py-3">{item.seasonName || seasons.find(s => s.id === item.seasonId)?.name || item.season || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${item.status === 'Inactive' ? 'bg-red-600 text-white shadow-sm' : 'bg-green-600 text-white shadow-sm'}`}>
                    {item.status || 'Active'}
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
        {filteredFarmers.length === 0 && <div className="text-center py-8 text-gray-500">No farmers yet</div>}
      </div>
    </div>
  );
}

export default FarmerManagement;
