import { useState, useEffect, useRef } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, X } from 'lucide-react';

function TicketCapture({ onClose, prefilledMarketCenter, prefilledSaleNumber }) {
  const { darkMode, currentUser, activePS, testMode } = useAppContext();
  const { items, loading, saveItem, deleteItem } = useStorage('ticket');
  const { items: farmers } = useStorage('farmer');
  const { items: grades } = useStorage('grade');
  const { items: marketCenters } = useStorage('marketcenter');
  const { items: saleNumbers } = useStorage('salenumber');

  const activePSValue = currentUser.role === 'Admin' ? (activePS || 'All') : currentUser.ps;
  const [showForm, setShowForm] = useState(false);
  const [selectedMarketCenter, setSelectedMarketCenter] = useState(prefilledMarketCenter || '');
  const [selectedSaleNumber, setSelectedSaleNumber] = useState(prefilledSaleNumber || '');
  const [selectedSaleDate, setSelectedSaleDate] = useState('');
  const [selectedPcn, setSelectedPcn] = useState('');
  const [workflowComplete, setWorkflowComplete] = useState(false);
  const [form, setForm] = useState({ ticketNumber: '', farmerId: '', gradeId: '', mass: '', value: '' });
  const ticketNumberRef = useRef(null);

  const handleMarketCenterChange = (mcId) => {
    setSelectedMarketCenter(mcId);
    setSelectedSaleNumber('');
    setSelectedSaleDate('');
    setSelectedPcn('');
    setWorkflowComplete(false);
  };

  const handleSaleNumberChange = (saleNum) => {
    setSelectedSaleNumber(saleNum);
    setSelectedSaleDate('');
    setSelectedPcn('');
    setWorkflowComplete(false);
  };

  const handleSaleDateChange = (date) => {
    setSelectedSaleDate(date);
    if (selectedMarketCenter && selectedSaleNumber && date && selectedPcn) {
      setWorkflowComplete(true);
    }
  };

  const handlePcnChange = (pcn) => {
    setSelectedPcn(pcn);
    if (selectedMarketCenter && selectedSaleNumber && selectedSaleDate && pcn) {
      setWorkflowComplete(true);
    } else {
      setWorkflowComplete(false);
    }
  };

  const handleGrade = (gradeId) => {
    const grade = grades.find(g => g.id === gradeId);
    if (grade) {
      const mass = parseFloat(form.mass) || 0;
      const value = mass * parseFloat(grade.price);
      setForm({...form, gradeId, value: value.toFixed(2)});
    }
  };

  const handleMass = (val) => {
    const grade = grades.find(g => g.id === form.gradeId);
    if (grade) {
      const mass = parseFloat(val) || 0;
      const value = mass * parseFloat(grade.price);
      setForm({...form, mass: val, value: value.toFixed(2)});
    }
  };

  const handleKeyDown = (e, nextFieldId, isTicketField = false) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (isTicketField) {
        const existing = items.find(t => t.ticketNumber === form.ticketNumber);
        if (existing) {
          setForm(prev => ({
            ...prev,
            farmerId: existing.farmerId,
            gradeId: existing.gradeId,
            mass: existing.mass,
            value: existing.value
          }));
        }
      }

      if (nextFieldId === 'submit') {
        handleSubmit();
      } else {
        document.getElementById(nextFieldId)?.focus();
      }
    }
  };

  const handleSubmit = async () => {
    if (!workflowComplete) {
      alert('Complete the workflow first: Market Center → Sale Number → Sale Date');
      return;
    }

    if (!form.ticketNumber || !form.farmerId || !form.gradeId) {
      alert('Fill all ticket fields');
      return;
    }

    // Auto-updates existing ticket implicitly over API since ID matches ticketNumber.

    const farmer = farmers.find(f => f.id === form.farmerId);
    const grade = grades.find(g => g.id === form.gradeId);
    const marketCenter = marketCenters.find(mc => mc.id === selectedMarketCenter);

    await saveItem(form.ticketNumber, {
      ...form,
      id: form.ticketNumber,
      marketCenter: marketCenter.name,
      marketCenterId: selectedMarketCenter,
      saleNumber: selectedSaleNumber,
      saleDate: selectedSaleDate,
      farmerName: `${farmer.firstName} ${farmer.lastName}`,
      farmerNumber: farmer.farmerNumber,
      gradeName: grade.name,
      gradePrice: grade.price,
      pcnNumber: selectedPcn,
      ps: farmer.ps,
      testMode,
      createdAt: new Date().toISOString(),
      capturedBy: currentUser.username
    });

    // Reset only the ticket fields to allow continuous scanning for the same Sale
    setForm({ ticketNumber: '', farmerId: '', gradeId: '', mass: '', value: '' });
    
    // Auto-focus ticket field for next entry
    setTimeout(() => {
      ticketNumberRef.current?.focus();
    }, 50);
  };

  const resetForm = () => {
    setForm({ ticketNumber: '', farmerId: '', gradeId: '', mass: '', value: '' });
    setSelectedMarketCenter('');
    setSelectedSaleNumber('');
    setSelectedSaleDate('');
    setSelectedPcn('');
    setWorkflowComplete(false);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete ticket?')) {
      try {
        await deleteItem(id);
      } catch (e) {
        console.error('Error deleting ticket:', e);
        alert('Error deleting ticket');
      }
    }
  };

  const filteredSaleNumbers = saleNumbers.filter(sn => sn.marketCenterId === selectedMarketCenter);

  const displayTickets = selectedSaleNumber 
    ? items.filter(t => t.saleNumber === selectedSaleNumber)
    : items;

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${darkMode ? 'bg-gray-900 text-white' : 'bg-slate-100 text-gray-900'} p-4 sm:p-8 flex flex-col`}>
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <button onClick={onClose} className={`p-2 rounded-full ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-200'} shadow transition`}>
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-3xl font-bold">Ticket Capture Mode</h2>
          </div>
          
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 transition font-semibold shadow-md text-white rounded-xl"
            >
              <Plus className="w-5 h-5" />
              <span>Start New Capture Session</span>
            </button>
          )}
        </div>

      {showForm && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8 mb-8 border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex justify-between mb-6">
            <h4 className="font-semibold">Ticket Capture Workflow</h4>
            <button onClick={resetForm}><X className="w-5 h-5" /></button>
          </div>

          {/* STEP 1: Market Center */}
          <div className={`p-4 rounded-lg mb-4 ${selectedMarketCenter ? 'bg-green-50 dark:bg-green-900' : 'bg-blue-50 dark:bg-gray-700'}`}>
            <div className="flex items-center space-x-2 mb-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${selectedMarketCenter ? 'bg-green-600 text-white' : 'bg-blue-600 text-white dark:bg-gray-600'}`}>1</span>
              <label className="font-semibold">Step 1: Select Market Center *</label>
            </div>
            <select
              value={selectedMarketCenter}
              onChange={(e) => handleMarketCenterChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
            >
              <option value="">-- Select Market Center --</option>
              {marketCenters.map(mc => (
                <option key={mc.id} value={mc.id}>{mc.name} ({mc.location || 'No location'})</option>
              ))}
            </select>
            {marketCenters.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">No market centers available. Create one in Registration → Market Centers.</p>
            )}
          </div>

          {/* STEP 2: Sale Number */}
          <div className={`p-4 rounded-lg mb-4 ${!selectedMarketCenter ? 'opacity-50' : selectedSaleNumber ? 'bg-green-50 dark:bg-green-900' : 'bg-blue-50 dark:bg-gray-700'}`}>
            <div className="flex items-center space-x-2 mb-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${selectedSaleNumber ? 'bg-green-600 text-white' : 'bg-blue-600 text-white dark:bg-gray-600'}`}>2</span>
              <label className="font-semibold">Step 2: Select Sale Number *</label>
            </div>
            <select
              value={selectedSaleNumber}
              onChange={(e) => handleSaleNumberChange(e.target.value)}
              disabled={!selectedMarketCenter}
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!selectedMarketCenter ? 'cursor-not-allowed' : ''}`}
            >
              <option value="">-- Select Sale Number --</option>
              {filteredSaleNumbers.map(sn => (
                <option key={sn.id} value={sn.saleNumber}>{sn.saleNumber}</option>
              ))}
            </select>
            {selectedMarketCenter && filteredSaleNumbers.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">No sale numbers for this market center. Create one in PCN Management.</p>
            )}
          </div>

          {/* STEP 3: Sale Date */}
          <div className={`p-4 rounded-lg mb-4 ${!selectedSaleNumber ? 'opacity-50' : selectedSaleDate ? 'bg-green-50 dark:bg-green-900' : 'bg-blue-50 dark:bg-gray-700'}`}>
            <div className="flex items-center space-x-2 mb-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${selectedSaleDate ? 'bg-green-600 text-white' : 'bg-blue-600 text-white dark:bg-gray-600'}`}>3</span>
              <label className="font-semibold">Step 3: Select Sale Date *</label>
            </div>
            <input
              type="date"
              value={selectedSaleDate}
              onChange={(e) => handleSaleDateChange(e.target.value)}
              disabled={!selectedSaleNumber}
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!selectedSaleNumber ? 'cursor-not-allowed' : ''}`}
            />
          </div>

          {/* STEP 4: PCN Number */}
          <div className={`p-4 rounded-lg mb-4 ${!selectedSaleDate ? 'opacity-50' : selectedPcn ? 'bg-green-50 dark:bg-green-900' : 'bg-blue-50 dark:bg-gray-700'}`}>
            <div className="flex items-center space-x-2 mb-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${selectedPcn ? 'bg-green-600 text-white' : 'bg-blue-600 text-white dark:bg-gray-600'}`}>4</span>
              <label className="font-semibold">Step 4: Enter PCN Number *</label>
            </div>
            <input
              type="text"
              value={selectedPcn}
              onChange={(e) => handlePcnChange(e.target.value)}
              disabled={!selectedSaleDate}
              placeholder="Enter Purchase Contract Note (PCN)"
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!selectedSaleDate ? 'cursor-not-allowed' : ''}`}
            />
          </div>

          {/* Workflow Summary */}
          {workflowComplete && (
            <div className={`p-4 rounded-lg mb-4 border-2 ${darkMode ? 'bg-green-900 border-green-700' : 'bg-green-50 border-green-200'}`}>
              <p className="font-semibold text-green-600 mb-2">✓ Workflow Complete - Ready to Capture Tickets</p>
              <div className="text-sm space-y-1">
                <p><strong>Market Center:</strong> {marketCenters.find(mc => mc.id === selectedMarketCenter)?.name}</p>
                <p><strong>Sale Number:</strong> {selectedSaleNumber}</p>
                <p><strong>Sale Date:</strong> {new Date(selectedSaleDate).toLocaleDateString()}</p>
                <p><strong>PCN:</strong> {selectedPcn}</p>
              </div>
            </div>
          )}

          {/* STEP 5: Ticket Details */}
          <div className={`p-4 rounded-lg ${!workflowComplete ? 'opacity-50' : 'border-2 border-green-500 dark:bg-gray-700'}`}>
            <div className="flex items-center space-x-2 mb-4">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${workflowComplete ? 'bg-green-600 text-white' : 'bg-gray-400 text-white dark:bg-gray-600'}`}>5</span>
              <h5 className="font-semibold">Step 5: Capture Ticket Details</h5>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm">Ticket Number *</label>
                <input
                  id="tc-ticket"
                  ref={ticketNumberRef}
                  type="text"
                  value={form.ticketNumber}
                  onChange={(e) => setForm({...form, ticketNumber: e.target.value})}
                  onKeyDown={(e) => handleKeyDown(e, 'tc-farmer', true)}
                  disabled={!workflowComplete}
                  placeholder="Scan or type ticket number"
                  className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!workflowComplete ? 'cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label className="block mb-2 text-sm">Farmer *</label>
                <select
                  id="tc-farmer"
                  value={form.farmerId}
                  onChange={(e) => setForm({...form, farmerId: e.target.value})}
                  onKeyDown={(e) => handleKeyDown(e, 'tc-grade')}
                  disabled={!workflowComplete}
                  className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!workflowComplete ? 'cursor-not-allowed' : ''}`}
                >
                  <option value="">Select Farmer</option>
                  {farmers
                    .filter(f => activePSValue === 'All' || f.ps === activePSValue)
                    .map(f => (
                      <option key={f.id} value={f.id}>{f.farmerNumber} - {f.firstName} {f.lastName}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 text-sm">Grade *</label>
                <select
                  id="tc-grade"
                  value={form.gradeId}
                  onChange={(e) => handleGrade(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'tc-mass')}
                  disabled={!workflowComplete}
                  className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!workflowComplete ? 'cursor-not-allowed' : ''}`}
                >
                  <option value="">Select Grade</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name} - ${g.price}/kg</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 text-sm">Mass (Kg) *</label>
                <input
                  id="tc-mass"
                  type="number"
                  step="0.01"
                  value={form.mass}
                  onChange={(e) => handleMass(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'submit')}
                  disabled={!workflowComplete}
                  className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!workflowComplete ? 'cursor-not-allowed' : ''}`}
                />
              </div>

              <div className="col-span-2">
                <label className="block mb-2 text-sm">Value (USD)</label>
                <input
                  type="number"
                  value={form.value}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-lg bg-gray-100 ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-4 mt-6">
            <button
              onClick={handleSubmit}
              disabled={!workflowComplete}
              className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 ${!workflowComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Save Ticket
            </button>
            <button onClick={resetForm} className={`px-6 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        <div className={`p-4 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className="font-semibold">{selectedSaleNumber ? `Captured Tickets - Sale ${selectedSaleNumber}` : 'All Captured Tickets (Select a Sale to filter)'}</h3>
        </div>
        <div className="overflow-x-auto text-sm">
          <table className="w-full">
          <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Ticket #</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">PCN #</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Market Center</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Sale #</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Sale Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Farmer</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Grade</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Mass (Kg)</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Value (USD)</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayTickets.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium">{item.ticketNumber}</td>
                <td className="px-4 py-3 font-medium text-purple-600 dark:text-purple-400">{item.pcnNumber || '-'}</td>
                <td className="px-4 py-3">{item.marketCenter}</td>
                <td className="px-4 py-3">{item.saleNumber}</td>
                <td className="px-4 py-3">{item.saleDate ? new Date(item.saleDate).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-3">{item.farmerName}</td>
                <td className="px-4 py-3">{item.gradeName}</td>
                <td className="px-4 py-3">{item.mass}</td>
                <td className="px-4 py-3 font-medium">${parseFloat(item.value).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(item.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {displayTickets.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {selectedSaleNumber ? `No tickets captured yet for Sale ${selectedSaleNumber}` : 'No tickets captured yet'}
          </div>
        )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default TicketCapture;
