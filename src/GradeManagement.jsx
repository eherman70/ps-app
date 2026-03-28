import { useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Edit, Trash2, X, Tag, Upload, FileDown, Info } from 'lucide-react';
import { parseCSV, generateCSV, downloadCSV } from './utils';
import { TOBACCO_GRADES_MASTER } from './data/tobaccoGrades';

function GradeManagement() {
  const { darkMode, currentUser } = useAppContext();
  const { items, loading, saveItem, deleteItem } = useStorage('grade');
  const isSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    grade_code: '', 
    name: '', 
    group_name: '', 
    category: '', 
    quality_level: '', 
    grade_class: 'STANDARD',
    is_quality_grade: 1,
    price: '', 
    description: '', 
    status: 'Active' 
  });
  const [editing, setEditing] = useState(null);

  const handleSubmit = async () => {
    if (!form.name || !form.price) {
      alert('Fill all required fields');
      return;
    }

    try {
      const itemData = { ...form, createdAt: editing?.createdAt || new Date().toISOString() };
      await saveItem(editing?.id, itemData);
      alert(editing ? 'Grade updated' : 'Grade registered');
      resetForm();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleGradeCodeChange = (code) => {
    const master = TOBACCO_GRADES_MASTER.find(g => g.code === code);
    if (master) {
      setForm({
        ...form,
        grade_code: code,
        name: master.description,
        group_name: master.group,
        category: master.category,
        quality_level: master.quality,
        grade_class: master.grade_class || 'STANDARD',
        is_quality_grade: master.is_quality_grade ?? 1,
        description: master.description
      });
    } else {
      setForm({ ...form, grade_code: code });
    }
  };

  const resetForm = () => {
    setForm({ 
      grade_code: '', 
      name: '', 
      group_name: '', 
      category: '', 
      quality_level: '', 
      grade_class: 'STANDARD',
      is_quality_grade: 1,
      price: '', 
      description: '', 
      status: 'Active' 
    });
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
    if (confirm('Delete this tobacco grade?')) {
      try {
        await deleteItem(id);
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
  };

  const downloadTemplate = () => {
    const headers = ['name', 'price', 'description', 'status'];
    const sample = [
      ['A1', '3.50', 'Top quality leaf', 'Active'],
      ['B1', '2.80', 'Standard quality', 'Active']
    ];
    const csv = generateCSV([headers, ...sample]);
    downloadCSV('tobacco_grades_template.csv', csv);
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
      
      let importedCount = 0;
      let errorCount = 0;

      for (const row of data) {
        if (row.length < 2) continue;
        
        const rowData = {};
        headers.forEach((h, i) => {
           rowData[h.trim()] = row[i];
        });

        if (!rowData.name || !rowData.price) {
           errorCount++;
           continue;
        }

        const gradeData = {
          grade_code: (rowData.grade_code || rowData.name).toUpperCase(),
          name: rowData.name.toUpperCase(),
          group_name: rowData.group_name || '',
          category: rowData.category || '',
          quality_level: rowData.quality_level || '',
          price: rowData.price,
          description: rowData.description || '',
          status: rowData.status || 'Active',
          createdAt: new Date().toISOString()
        };

        try {
          // Check if grade_code already exists in local items to avoid duplicates
          const exists = items.find(g => g.grade_code === gradeData.grade_code);
          if (!exists) {
            await saveItem(null, gradeData);
            importedCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          errorCount++;
        }
      }

      alert(`Import complete! Successfully imported: ${importedCount}, Errors: ${errorCount}`);
      e.target.value = null;
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h3 className="text-xl font-semibold">Tobacco Grades</h3>
        {isSupervisor && (
          <div className="flex space-x-2">
            <button
              onClick={downloadTemplate}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              title="Download Template"
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
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow"
            >
              <Plus className="w-5 h-5" />
              <span>New Grade</span>
            </button>
          </div>
        )}
      </div>

      {showForm && isSupervisor && (
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl shadow-lg p-6 mb-8 border`}>
          <div className="flex justify-between mb-6">
            <h4 className="font-semibold text-lg">{editing ? 'Edit' : 'New'} Tobacco Grade</h4>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-500" /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block mb-2 text-sm font-medium">Select Grade Code *</label>
              <select
                value={form.grade_code}
                onChange={(e) => handleGradeCodeChange(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="">-- Select Code --</option>
                {TOBACCO_GRADES_MASTER.map(m => (
                  <option key={m.code} value={m.code}>{m.code} - {m.description}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Grade Name (Auto)</label>
              <input
                type="text"
                readOnly
                value={form.name}
                className={`w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Buying Price (USD/Kg) *</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({...form, price: e.target.value})}
                placeholder="0.00"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Grade Class</label>
              <select
                value={form.grade_class}
                onChange={(e) => setForm({...form, grade_class: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${form.grade_class === 'PREMIUM' || form.group_name === 'LEAF_ORANGE_FULL' ? 'border-amber-500 ring-1 ring-amber-500 bg-amber-50/10' : ''}`}
              >
                <option value="STANDARD">STANDARD</option>
                <option value="PREMIUM">PREMIUM</option>
                <option value="REJECT">REJECT</option>
                <option value="PROCESS">PROCESS</option>
                <option value="SPECIAL">SPECIAL</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <input
                type="checkbox"
                id="is_quality_grade"
                checked={form.is_quality_grade === 1}
                onChange={(e) => setForm({...form, is_quality_grade: e.target.checked ? 1 : 0})}
                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <label htmlFor="is_quality_grade" className="text-sm font-medium">
                Quality Grade (Include in production totals)
              </label>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
             <div>
                <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Category</p>
                <p className="font-semibold">{form.category || '-'}</p>
             </div>
             <div>
                <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Group Name</p>
                <p className="font-semibold">{form.group_name || '-'}</p>
             </div>
             <div>
                <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Quality Level</p>
                <p className="font-semibold">{form.quality_level || '-'}</p>
             </div>
          </div>

          <div className="flex space-x-4 mt-8">
            <button onClick={handleSubmit} className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
              Save Grade
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
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Name / Group</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Level</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Class / Quality</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Price (USD)</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-center">Status</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map(item => {
              const isPremium = item.group_name === 'LEAF_ORANGE_FULL' || item.grade_class === 'PREMIUM';
              return (
              <tr key={item.id} className={`${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} transition ${isPremium ? (darkMode ? 'bg-amber-900/10' : 'bg-amber-50') : ''}`}>
                <td className={`px-6 py-4 font-bold ${isPremium ? 'text-amber-600' : (darkMode ? 'text-green-400' : 'text-green-600')}`}>
                  {item.grade_code || '-'}
                  {isPremium && <span className="ml-2 text-[8px] px-1 bg-amber-100 text-amber-700 rounded border border-amber-200">PREMIUM</span>}
                </td>
                <td className="px-6 py-4">
                   <div className="font-semibold">{item.name}</div>
                   <div className="text-[10px] text-gray-500 uppercase tracking-tight">{item.group_name}</div>
                </td>
                <td className="px-6 py-4">
                   <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded shadow-sm">
                      {item.category}
                   </span>
                </td>
                <td className="px-6 py-4">
                   <span className="text-gray-600 dark:text-gray-400 font-medium italic">{item.quality_level}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{item.grade_class}</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-center w-fit ${
                      item.is_quality_grade === 1 
                        ? 'bg-green-600 text-white border-green-700 shadow-sm'
                        : 'bg-orange-600 text-white border-orange-700 shadow-sm'
                    }`}>
                      {item.is_quality_grade === 1 ? 'QUALITY' : 'OPERATIONAL'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">
                   ${parseFloat(item.price).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    item.status === 'Active' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-600 text-white shadow-sm'
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
            );
          })}
          </tbody>
        </table>
        {items.length === 0 && !loading && <div className="text-center py-12 text-gray-500 italic">No tobacco grades defined yet</div>}
        {loading && <div className="text-center py-12 text-gray-500">Loading grades...</div>}
      </div>
    </div>
  );
}

export default GradeManagement;
