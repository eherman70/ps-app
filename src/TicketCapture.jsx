import { useState, useEffect, useRef } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, X, AlertTriangle, CheckCircle, Edit3, Trash2 } from 'lucide-react';
import { TOBACCO_GRADES_MASTER } from './data/tobaccoGrades';

function TicketCapture({ onClose, prefilledMarketCenter, prefilledSaleNumber, prefilledSaleNumberId }) {
  const { darkMode, currentUser, activePS, testMode } = useAppContext();
  const { items, loading, saveItem, deleteItem, refreshItems } = useStorage('ticket');
  const { items: farmers } = useStorage('farmer');
  const { items: grades } = useStorage('grade');
  const { items: marketCenters } = useStorage('marketcenter');
  const { items: saleNumbers } = useStorage('salenumber');

  const isSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';
  const activePSValue = isSupervisor ? (activePS || 'All') : currentUser.ps;

  const [showForm, setShowForm] = useState(false);
  const [selectedMarketCenter, setSelectedMarketCenter] = useState(prefilledMarketCenter || '');
  const [selectedSaleNumber, setSelectedSaleNumber] = useState(prefilledSaleNumber || '');
  const [selectedSaleNumberId, setSelectedSaleNumberId] = useState(prefilledSaleNumberId || '');
  const [selectedSaleDate, setSelectedSaleDate] = useState('');
  const [selectedPcn, setSelectedPcn] = useState('');
  const [workflowComplete, setWorkflowComplete] = useState(false);
  const [form, setForm] = useState({ ticketNumber: '', farmerId: '', gradeId: '', mass: '', value: '' });
  const [duplicateTicket, setDuplicateTicket] = useState(null); // existing ticket data
  const [isUpdateMode, setIsUpdateMode] = useState(false); // true = updating existing ticket
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const ticketNumberRef = useRef(null);
  
  // Failsafe: if we have a sale number but no ID, find it
  useEffect(() => {
    if (selectedSaleNumber && !selectedSaleNumberId) {
      const sn = saleNumbers.find(s => s.saleNumber === selectedSaleNumber);
      if (sn) {
        console.log('Resolving saleNumberId for:', selectedSaleNumber, '->', sn.id);
        setSelectedSaleNumberId(sn.id);
      }
    }
  }, [selectedSaleNumber, selectedSaleNumberId, saleNumbers]);

  const handleMarketCenterChange = (mcId) => {
    setSelectedMarketCenter(mcId);
    setSelectedSaleNumber('');
    setSelectedSaleNumberId('');
    setSelectedSaleDate('');
    setSelectedPcn('');
    setWorkflowComplete(false);
    clearDuplicate();
  };

  const handleSaleNumberChange = (snObj) => {
    setSelectedSaleNumber(snObj.saleNumber);
    setSelectedSaleNumberId(snObj.id);
    setSelectedSaleDate('');
    setSelectedPcn('');
    setWorkflowComplete(false);
    clearDuplicate();
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

  const clearDuplicate = () => {
    setDuplicateTicket(null);
    setIsUpdateMode(false);
  };

  const handleGrade = (gradeId) => {
    const grade = grades.find(g => g.id === gradeId);
    if (grade) {
      const mass = parseFloat(form.mass) || 0;
      const value = mass * parseFloat(grade.price);
      setForm({...form, gradeId, value: value.toFixed(2)});
    } else {
      setForm({...form, gradeId});
    }
  };

  const handleMass = (val) => {
    const grade = grades.find(g => g.id === form.gradeId);
    if (grade) {
      const mass = parseFloat(val) || 0;
      const value = mass * parseFloat(grade.price);
      setForm({...form, mass: val, value: value.toFixed(2)});
    } else {
      setForm({...form, mass: val});
    }
  };

  // Check duplicate ticket via API
  const checkDuplicateTicket = async (ticketNum) => {
    if (!ticketNum) { clearDuplicate(); return; }
    setCheckingDuplicate(true);
    try {
      const result = await window.api.request(`/tickets/check/${encodeURIComponent(ticketNum)}`);
      if (result.exists) {
        setDuplicateTicket(result.ticket);
        setIsUpdateMode(false); // warn by default, supervisor must click edit
        // Pre-fill form with existing data
        setForm({
          ticketNumber: ticketNum,
          farmerId: result.ticket.farmerId || '',
          gradeId: result.ticket.gradeId || '',
          mass: String(result.ticket.netWeight || result.ticket.mass || ''),
          value: String(result.ticket.totalValue || result.ticket.value || '')
        });
      } else {
        clearDuplicate();
      }
    } catch (e) {
      // If check fails, don't block the user
      console.warn('Duplicate check error:', e);
      clearDuplicate();
    }
    setCheckingDuplicate(false);
  };

  const handleKeyDown = (e, nextFieldId, isTicketField = false) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If ENTER on ticket number, trigger duplicate check immediately
      if (isTicketField) {
        checkDuplicateTicket(form.ticketNumber);
      }
      
      if (nextFieldId === 'submit') {
        handleSubmit();
      } else {
        const nextEl = document.getElementById(nextFieldId);
        if (nextEl) {
          nextEl.focus();
          if (nextEl.tagName === 'SELECT') {
            // Optional: open select on focus if possible, or just focus it
          }
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!workflowComplete) {
      alert('Complete the workflow first: Market Center → Sale Number → Sale Date → PCN');
      return;
    }
    if (!form.ticketNumber || !form.farmerId || !form.gradeId || !form.mass) {
      alert('Fill all ticket fields');
      return;
    }

    // If duplicate and not in update mode, block non-supervisors
    if (duplicateTicket && !isUpdateMode) {
      if (!isSupervisor) {
        alert('This ticket already exists. Contact a supervisor to update it.');
        return;
      }
      alert('Please click "Update Existing Ticket" to update this ticket.');
      return;
    }

    const farmer = farmers.find(f => f.id === form.farmerId);
    const grade = grades.find(g => g.id === form.gradeId);
    let effectiveSaleNumberId = selectedSaleNumberId;
    const marketCenter = marketCenters.find(mc => mc.id === selectedMarketCenter);
    const saleNum = saleNumbers.find(sn => sn.id === selectedSaleNumberId);

    const grossWeight = parseFloat(form.mass);
    const netWeight = grossWeight;
    const pricePerKg = grade ? parseFloat(grade.price) : 0;
    const totalValue = parseFloat(form.value) || (netWeight * pricePerKg);

    if (isUpdateMode && duplicateTicket) {
      // Update existing ticket via API
      try {
        await window.api.request(`/tickets/${duplicateTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            farmerId: form.farmerId,
            gradeId: form.gradeId,
            grade_code: grade ? grade.grade_code : '',
            marketCenterId: selectedMarketCenter,
            saleNumberId: selectedSaleNumberId || duplicateTicket.saleNumberId,
            grossWeight,
            tareWeight: 0,
            netWeight,
            pricePerKg,
            totalValue,
            captureDate: selectedSaleDate,
            pcnNumber: selectedPcn
          })
        });
        if (refreshItems) refreshItems();
        alert('Ticket updated successfully');
        clearDuplicate();
        setForm({ ticketNumber: '', farmerId: '', gradeId: '', mass: '', value: '' });
        setTimeout(() => ticketNumberRef.current?.focus(), 50);
      } catch (e) {
        alert('Error updating ticket: ' + e.message);
      }
      return;
    }

    if (!selectedSaleNumberId) {
      const snFound = saleNumbers.find(s => s.saleNumber === selectedSaleNumber);
      if (snFound) {
        // Use the found ID if state hasn't updated yet
        console.warn('selectedSaleNumberId was empty in handleSubmit, using found ID:', snFound.id);
        effectiveSaleNumberId = snFound.id;
      } else {
        alert('Internal Error: Sale Number ID not found. Please re-select the Sale Number.');
        return;
      }
    }

    // Create new ticket via API
    try {
      console.log('Creating ticket with saleNumberId:', effectiveSaleNumberId);
      await window.api.create('tickets', {
        ticketNumber: form.ticketNumber,
        pcnNumber: selectedPcn,
        farmerId: form.farmerId,
        gradeId: form.gradeId,
        grade_code: grade ? grade.grade_code : '',
        marketCenterId: selectedMarketCenter,
        saleNumberId: effectiveSaleNumberId,
        grossWeight,
        tareWeight: 0,
        netWeight,
        pricePerKg,
        totalValue,
        captureDate: selectedSaleDate,
        ps: farmer ? farmer.ps : activePSValue,
        testMode
      });
      if (refreshItems) refreshItems();
    } catch (e) {
      if (e.message && e.message.includes('409')) {
        alert('Duplicate ticket! This ticket number already exists.');
        return;
      }
      alert('Error saving ticket: ' + e.message);
      return;
    }

    setForm({ ticketNumber: '', farmerId: '', gradeId: '', mass: '', value: '' });
    clearDuplicate();
    setTimeout(() => ticketNumberRef.current?.focus(), 50);
  };

  const resetForm = () => {
    setForm({ ticketNumber: '', farmerId: '', gradeId: '', mass: '', value: '' });
    setSelectedMarketCenter('');
    setSelectedSaleNumber('');
    setSelectedSaleNumberId('');
    setSelectedSaleDate('');
    setSelectedPcn('');
    setWorkflowComplete(false);
    clearDuplicate();
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!isSupervisor) return alert('Only supervisors can delete tickets');
    if (confirm('Delete ticket?')) {
      try {
        await window.api.delete('tickets', id);
        if (refreshItems) refreshItems();
      } catch (e) {
        alert('Error deleting ticket: ' + e.message);
      }
    }
  };

  const filteredSaleNumbers = saleNumbers.filter(sn => sn.marketCenterId === selectedMarketCenter);

  const displayTickets = selectedSaleNumber
    ? items.filter(t => t.saleNumber === selectedSaleNumber)
    : items.filter(t => activePSValue === 'All' || t.ps === activePSValue);

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${darkMode ? 'bg-gray-900 text-white' : 'bg-slate-100 text-gray-900'} p-4 sm:p-8 flex flex-col`}>
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <button onClick={onClose} className={`p-2 rounded-full ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-200'} shadow transition`}>
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-3xl font-bold">Ticket Capture Mode</h2>
            {testMode && <span className="px-3 py-1 bg-yellow-500 text-white text-sm font-bold rounded-full">TEST MODE</span>}
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
            <StepCard step={1} done={!!selectedMarketCenter} darkMode={darkMode} label="Select Market Center *">
              <select
                value={selectedMarketCenter}
                onChange={(e) => handleMarketCenterChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              >
                <option value="">-- Select Market Center --</option>
                {marketCenters.map(mc => (
                  <option key={mc.id} value={mc.id}>{mc.name}{mc.location ? ` (${mc.location})` : ''}</option>
                ))}
              </select>
              {marketCenters.length === 0 && <p className="text-xs text-yellow-600 mt-1">No market centers found. Create one in Registration → Market Centers.</p>}
            </StepCard>

            {/* STEP 2: Sale Number */}
            <StepCard step={2} done={!!selectedSaleNumber} disabled={!selectedMarketCenter} darkMode={darkMode} label="Select Sale Number *">
              <select
                value={selectedSaleNumber}
                onChange={(e) => {
                  const sn = filteredSaleNumbers.find(s => s.saleNumber === e.target.value);
                  if (sn) handleSaleNumberChange(sn);
                }}
                disabled={!selectedMarketCenter}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!selectedMarketCenter ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <option value="">-- Select Sale Number --</option>
                {filteredSaleNumbers.map(sn => (
                  <option key={sn.id} value={sn.saleNumber}>{sn.saleNumber}</option>
                ))}
              </select>
              {selectedMarketCenter && filteredSaleNumbers.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">No sale numbers for this market center.</p>
              )}
            </StepCard>

            {/* STEP 3: Sale Date */}
            <StepCard step={3} done={!!selectedSaleDate} disabled={!selectedSaleNumber} darkMode={darkMode} label="Select Sale Date *">
              <input
                type="date"
                value={selectedSaleDate}
                onChange={(e) => handleSaleDateChange(e.target.value)}
                disabled={!selectedSaleNumber}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!selectedSaleNumber ? 'cursor-not-allowed opacity-60' : ''}`}
              />
            </StepCard>

            {/* STEP 4: PCN Number */}
            <StepCard step={4} done={!!selectedPcn} disabled={!selectedSaleDate} darkMode={darkMode} label="Enter PCN Number *">
              <input
                type="text"
                value={selectedPcn}
                onChange={(e) => handlePcnChange(e.target.value)}
                disabled={!selectedSaleDate}
                placeholder="Enter Purchase Contract Note (PCN)"
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!selectedSaleDate ? 'cursor-not-allowed opacity-60' : ''}`}
              />
            </StepCard>

            {/* Workflow Summary */}
            {workflowComplete && (
              <div className={`p-4 rounded-lg mb-4 border-2 ${darkMode ? 'bg-green-900 border-green-700' : 'bg-green-50 border-green-200'}`}>
                <p className="font-semibold text-green-600 mb-2">✓ Workflow Complete — Ready to Capture Tickets</p>
                <div className="text-sm grid grid-cols-2 gap-4">
                  <p><strong>Market Center:</strong> {marketCenters.find(mc => mc.id === selectedMarketCenter)?.name}</p>
                  <p><strong>Sale Number:</strong> {selectedSaleNumber}</p>
                  <p><strong>Sale Date:</strong> {selectedSaleDate}</p>
                  <div className="flex items-center justify-between col-span-2 mt-2 p-2 bg-white/10 rounded-lg border border-white/20">
                    <p><strong>Current PCN:</strong> <span className="text-xl font-black bg-white text-green-800 px-3 py-1 rounded-md ml-2">{selectedPcn}</span></p>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold opacity-70">Tickets in PCN</p>
                      <p className={`text-2xl font-black ${items.filter(t => t.pcnNumber === selectedPcn).length >= 25 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                        {items.filter(t => t.pcnNumber === selectedPcn).length} / 25
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Ticket Details */}
            <div className={`p-4 rounded-lg ${!workflowComplete ? 'opacity-40' : 'border-2 border-green-500'} ${darkMode ? 'bg-gray-700' : ''}`}>
              <div className="flex items-center space-x-2 mb-4">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${workflowComplete ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'}`}>5</span>
                <h5 className="font-semibold">Capture Ticket Details</h5>
              </div>

              {/* Duplicate warning */}
              {duplicateTicket && (
                <div className={`mb-6 p-5 rounded-2xl border-2 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 ${isSupervisor ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${isSupervisor ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className={`text-lg font-bold ${isSupervisor ? 'text-amber-900 dark:text-amber-200' : 'text-rose-900 dark:text-rose-200'}`}>
                          {isSupervisor ? 'Existing Ticket Detected' : 'Unauthorized Duplicate Capture'}
                        </p>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isSupervisor ? 'bg-amber-200 text-amber-800' : 'bg-rose-200 text-rose-800'}`}>
                          {isSupervisor ? 'Supervisor Review' : 'Clerk Warning'}
                        </span>
                      </div>
                      <p className="text-sm mt-1 opacity-90 leading-relaxed">
                        Ticket <span className="font-mono font-bold font-black">{duplicateTicket.ticketNumber}</span> has already been captured for:
                        <br />
                        <span className="font-semibold">{duplicateTicket.firstName} {duplicateTicket.lastName}</span> · 
                        Grade: {duplicateTicket.gCode || duplicateTicket.grade_code} · 
                        Mass: {duplicateTicket.netWeight} Kg
                      </p>
                      
                      <div className="mt-4 flex flex-wrap gap-3">
                        {isSupervisor ? (
                          !isUpdateMode ? (
                            <button
                              onClick={() => setIsUpdateMode(true)}
                              className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 shadow-md transition-all active:scale-95"
                            >
                              <Edit3 className="w-4 h-4" /> Load & Edit This Ticket
                            </button>
                          ) : (
                            <div className="flex items-center gap-3 py-2 px-4 bg-green-100 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-800">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-800 dark:text-green-300 font-bold">In Update Mode</span>
                              <button onClick={() => setIsUpdateMode(false)} className="text-xs text-green-700 dark:text-green-400 font-semibold hover:underline px-2 border-l border-green-300 ml-2">Exit</button>
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold shadow-lg">
                            <X className="w-4 h-4" /> Entry Blocked — Contact Supervisor
                          </div>
                        )}
                        <button 
                          onClick={() => { setForm({...form, ticketNumber: ''}); clearDuplicate(); ticketNumberRef.current?.focus(); }}
                          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50 bg-white'}`}
                        >
                          Clear & Scan New
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm">Ticket Number *</label>
                  <input
                    id="tc-ticket"
                    ref={ticketNumberRef}
                    type="text"
                    value={form.ticketNumber}
                    onChange={(e) => { setForm({...form, ticketNumber: e.target.value}); clearDuplicate(); }}
                    onKeyDown={(e) => handleKeyDown(e, 'tc-farmer', true)}
                    onBlur={() => form.ticketNumber && checkDuplicateTicket(form.ticketNumber)}
                    disabled={!workflowComplete}
                    placeholder="Scan or type ticket number"
                    className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${!workflowComplete ? 'cursor-not-allowed opacity-60' : duplicateTicket ? 'border-yellow-500' : ''}`}
                  />
                  {checkingDuplicate && <p className="text-xs text-gray-400 mt-1">Checking...</p>}
                </div>

                <div>
                  <label className="block mb-2 text-sm">Farmer *</label>
                  <select
                    id="tc-farmer"
                    value={form.farmerId}
                    onChange={(e) => setForm({...form, farmerId: e.target.value})}
                    onKeyDown={(e) => handleKeyDown(e, 'tc-grade')}
                    disabled={!workflowComplete || (duplicateTicket && !isUpdateMode)}
                    className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${(!workflowComplete || (duplicateTicket && !isUpdateMode)) ? 'cursor-not-allowed opacity-60' : ''}`}
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
                    disabled={!workflowComplete || (duplicateTicket && !isUpdateMode)}
                    className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${(!workflowComplete || (duplicateTicket && !isUpdateMode)) ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <option value="">Select Grade</option>
                    {['LUGS', 'CUTTERS', 'THIN_LEAF', 'LEAF', 'Full Orange Leaf (Premium)', 'Other'].map(cat => {
                      const catGrades = grades.filter(g => {
                        if (cat === 'Full Orange Leaf (Premium)') return g.group_name === 'LEAF_ORANGE_FULL';
                        if (cat === 'LEAF') return g.category === 'LEAF' && g.group_name !== 'LEAF_ORANGE_FULL';
                        return (g.category || 'Other') === cat;
                      });
                      if (catGrades.length === 0) return null;
                      return (
                        <optgroup key={cat} label={cat}>
                          {catGrades.sort((a,b) => {
                            const order = ['Choice', 'Fine', 'Good', 'Fair', 'Low', 'Reject'];
                            return order.indexOf(a.quality_level || 'Reject') - order.indexOf(b.quality_level || 'Reject');
                          }).map(g => (
                            <option key={g.id} value={g.id}>{g.grade_code} - ${g.price} ({g.quality_level})</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  {form.gradeId && (
                    <p className="text-[10px] text-blue-600 mt-1 uppercase font-bold">
                       {grades.find(g => g.id === form.gradeId)?.name}
                    </p>
                  )}
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
                    disabled={!workflowComplete || (duplicateTicket && !isUpdateMode)}
                    className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'} ${(!workflowComplete || (duplicateTicket && !isUpdateMode)) ? 'cursor-not-allowed opacity-60' : ''}`}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block mb-2 text-sm">Value (USD)</label>
                  <input
                    type="number"
                    value={form.value}
                    readOnly
                    className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300 bg-gray-50'}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={handleSubmit}
                disabled={!workflowComplete}
                className={`px-6 py-2 text-white rounded-lg ${
                  isUpdateMode
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-green-600 hover:bg-green-700'
                } ${!workflowComplete ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {isUpdateMode ? 'Update Ticket' : duplicateTicket ? 'Ticket Exists (Blocked)' : 'Save Ticket'}
              </button>
              <button onClick={resetForm} className={`px-6 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Ticket List */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
          <div className={`p-4 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <h3 className="font-semibold">
              {selectedSaleNumber ? `Captured Tickets — Sale ${selectedSaleNumber}` : 'All Captured Tickets (select a Sale to filter)'}
            </h3>
          </div>
          <div className="overflow-x-auto text-sm">
            <table className="w-full">
              <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Ticket #</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">PCN #</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Market</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Sale #</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Farmer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Grade</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Mass (Kg)</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Value (USD)</th>
                  {isSupervisor && <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {displayTickets.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium">{item.ticketNumber}</td>
                    <td className="px-4 py-3 text-purple-600 dark:text-purple-400">{item.pcnNumber || '-'}</td>
                    <td className="px-4 py-3">{item.marketCenterName || item.marketCenter || '-'}</td>
                    <td className="px-4 py-3">{item.saleNumber}</td>
                    <td className="px-4 py-3">{item.captureDate ? new Date(item.captureDate).toLocaleDateString() : (item.saleDate ? new Date(item.saleDate).toLocaleDateString() : '-')}</td>
                    <td className="px-4 py-3">{item.firstName ? `${item.firstName} ${item.lastName}` : item.farmerName}</td>
                    <td className="px-4 py-3">{item.gradeName}</td>
                    <td className="px-4 py-3">{item.netWeight || item.mass}</td>
                    <td className="px-4 py-3 font-medium">${parseFloat(item.totalValue || item.value || 0).toFixed(2)}</td>
                    {isSupervisor && (
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(item.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {displayTickets.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {selectedSaleNumber ? `No tickets captured for Sale ${selectedSaleNumber}` : 'No tickets captured yet'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper step card component
function StepCard({ step, done, disabled, darkMode, label, children }) {
  return (
    <div className={`p-4 rounded-lg mb-4 transition-all ${
      disabled ? 'opacity-50' :
      done ? (darkMode ? 'bg-green-900/40 border border-green-700' : 'bg-green-50 border border-green-200') :
      (darkMode ? 'bg-gray-700' : 'bg-blue-50 border border-blue-100')
    }`}>
      <div className="flex items-center space-x-2 mb-2">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${done ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>{step}</span>
        <label className="font-semibold text-sm">Step {step}: {label}</label>
      </div>
      {children}
    </div>
  );
}

export default TicketCapture;
