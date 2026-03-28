import { useState, useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Trash2, X, Eye } from 'lucide-react';
import { filterItemsByPS, getScopedPS } from './utils';

function PCNList() {
  const { darkMode, currentUser, activePS } = useAppContext();
  const { items: pcns, loading, saveItem, deleteItem, refreshItems } = useStorage('pcn');
  const { items: tickets, refreshItems: refreshTickets } = useStorage('ticket');

  const isSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';
  const activePSValue = getScopedPS(currentUser, activePS);
  const scopedTickets = filterItemsByPS(tickets, activePSValue);
  const scopedPcns = filterItemsByPS(pcns, activePSValue);

  const [showForm, setShowForm] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [form, setForm] = useState({ pcnNumber: '', saleNumber: '', ps: '' });
  const [loadingPCN, setLoadingPCN] = useState(false);
  const [filter, setFilter] = useState({ status: 'All', saleNumber: '', ps: '' });
  const [detailPcn, setDetailPcn] = useState(null);

  const loadAvailableTickets = () => {
    return scopedTickets.filter(t => !t.pcnNumber);
  };

  const handleTicketSelect = (ticket) => {
    if (selectedTickets.length > 0) {
      const firstSaleNumber = selectedTickets[0].saleNumber;
      if (ticket.saleNumber !== firstSaleNumber) {
        return alert('Cannot mix sale numbers in one PCN');
      }
      const firstPS = selectedTickets[0].ps;
      if (ticket.ps !== firstPS) {
        return alert('Cannot mix PS in one PCN');
      }
    }
    if (selectedTickets.length >= 25) {
      return alert('Maximum 25 tickets per PCN');
    }
    const exists = selectedTickets.find(t => t.id === ticket.id);
    if (exists) {
      setSelectedTickets(selectedTickets.filter(t => t.id !== ticket.id));
    } else {
      const newSelection = [...selectedTickets, ticket];
      setSelectedTickets(newSelection);
      if (newSelection.length === 1) {
        setForm({
          pcnNumber: `PCN-${Date.now()}`,
          saleNumber: ticket.saleNumber,
          ps: ticket.ps
        });
      }
    }
  };

  const createPCN = async () => {
    if (selectedTickets.length === 0) return alert('Select at least one ticket');
    if (!form.pcnNumber) return alert('PCN number is required');

    setLoadingPCN(true);
    try {
      const totalBales = selectedTickets.length;
      const totalMass = selectedTickets.reduce((sum, t) => sum + parseFloat(t.mass || t.netWeight || 0), 0);
      const totalValue = selectedTickets.reduce((sum, t) => sum + parseFloat(t.value || t.totalValue || 0), 0);
      const uniqueFarmers = new Set(selectedTickets.map(t => t.farmerId)).size;

      // Create PCN via API
      const pcnData = await window.api.create('pcns', {
        pcnNumber: form.pcnNumber,
        saleNumber: form.saleNumber,
        ps: form.ps,
        totalFarmers: uniqueFarmers,
        totalTickets: totalBales,
        totalWeight: totalMass,
        totalValue,
        status: 'Open'
      });

      // Update each ticket's PCN number via API
      for (const ticket of selectedTickets) {
        await window.api.request(`/tickets/${ticket.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...ticket,
            farmerId: ticket.farmerId,
            gradeId: ticket.gradeId,
            marketCenterId: ticket.marketCenterId,
            saleNumberId: ticket.saleNumberId,
            grossWeight: ticket.grossWeight || ticket.mass,
            tareWeight: ticket.tareWeight || 0,
            netWeight: ticket.netWeight || ticket.mass,
            pricePerKg: ticket.pricePerKg || ticket.gradePrice || 0,
            totalValue: ticket.totalValue || ticket.value || 0,
            captureDate: ticket.captureDate || ticket.saleDate || new Date().toISOString().slice(0, 10),
            pcnNumber: form.pcnNumber
          })
        });
      }

      if (refreshItems) refreshItems();
      if (refreshTickets) refreshTickets();
      alert('PCN created successfully');
      resetForm();
    } catch (e) {
      console.error('Error creating PCN:', e);
      alert('Error creating PCN: ' + e.message);
    }
    setLoadingPCN(false);
  };

  const resetForm = () => {
    setForm({ pcnNumber: '', saleNumber: '', ps: '' });
    setSelectedTickets([]);
    setShowForm(false);
  };

  const closePCN = async (pcn) => {
    if (!isSupervisor) return alert('Only supervisors can close PCNs');
    if (!confirm('Close this PCN? This action cannot be undone.')) return;
    try {
      await window.api.request(`/pcns/${pcn.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Closed' })
      });
      if (refreshItems) refreshItems();
      alert('PCN closed successfully');
    } catch (e) {
      alert('Error closing PCN: ' + e.message);
    }
  };

  const approvePCN = async (pcn) => {
    if (!isSupervisor) return alert('Only supervisors can approve PCNs');
    if (pcn.status !== 'Closed') return alert('PCN must be closed before approval');
    if (!confirm('Approve this PCN?')) return;
    try {
      await window.api.request(`/pcns/${pcn.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Approved' })
      });
      if (refreshItems) refreshItems();
      alert('PCN approved successfully');
    } catch (e) {
      alert('Error approving PCN: ' + e.message);
    }
  };

  const deletePCN = async (pcn) => {
    if (!isSupervisor) return alert('Only supervisors can delete PCNs');
    if (pcn.status === 'Approved') return alert('Cannot delete an approved PCN');
    if (!confirm('Delete this PCN? Tickets will be released.')) return;
    try {
      // Release tickets that belong to this PCN
      const pcnTickets = scopedTickets.filter(t => t.pcnNumber === pcn.pcnNumber);
      for (const ticket of pcnTickets) {
        await window.api.request(`/tickets/${ticket.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...ticket,
            farmerId: ticket.farmerId,
            gradeId: ticket.gradeId,
            marketCenterId: ticket.marketCenterId,
            saleNumberId: ticket.saleNumberId,
            grossWeight: ticket.grossWeight || ticket.mass,
            tareWeight: ticket.tareWeight || 0,
            netWeight: ticket.netWeight || ticket.mass,
            pricePerKg: ticket.pricePerKg || ticket.gradePrice || 0,
            totalValue: ticket.totalValue || ticket.value || 0,
            captureDate: ticket.captureDate || ticket.saleDate || new Date().toISOString().slice(0, 10),
            pcnNumber: null
          })
        });
      }
      await window.api.delete('pcns', pcn.id);
      if (refreshItems) refreshItems();
      if (refreshTickets) refreshTickets();
      alert('PCN deleted and tickets released');
    } catch (e) {
      alert('Error deleting PCN: ' + e.message);
    }
  };

  const filteredPCNs = scopedPcns
    .filter(pcn => {
      if (filter.status !== 'All' && pcn.status !== filter.status) return false;
      if (filter.saleNumber && !pcn.saleNumber?.toLowerCase().includes(filter.saleNumber.toLowerCase())) return false;
      if (filter.ps && !pcn.ps?.toLowerCase().includes(filter.ps.toLowerCase())) return false;
      return true;
    });

  const availableTickets = loadAvailableTickets();
  const groupedTickets = availableTickets.reduce((acc, ticket) => {
    const key = `${ticket.saleNumber}_${ticket.ps}`;
    if (!acc[key]) acc[key] = { saleNumber: ticket.saleNumber, ps: ticket.ps, tickets: [] };
    acc[key].tickets.push(ticket);
    return acc;
  }, {});

  const statusColor = (s) => {
    if (s === 'Open') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    if (s === 'Closed') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">PCN Management</h3>
        {isSupervisor && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-5 h-5" />
            <span>Create PCN</span>
          </button>
        )}
      </div>

      {/* Create PCN Form */}
      {showForm && isSupervisor && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-6`}>
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold">Create New PCN</h4>
            <button onClick={resetForm}><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block mb-2 text-sm">PCN Number *</label>
              <input
                type="text"
                value={form.pcnNumber}
                onChange={(e) => setForm({...form, pcnNumber: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                placeholder="Auto-generated"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm">Sale Number</label>
              <input type="text" value={form.saleNumber} readOnly
                className={`w-full px-3 py-2 border rounded-lg bg-gray-100 ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} />
            </div>
            <div>
              <label className="block mb-2 text-sm">PS</label>
              <input type="text" value={form.ps} readOnly
                className={`w-full px-3 py-2 border rounded-lg bg-gray-100 ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} />
            </div>
          </div>

          <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
            <p className="text-sm font-semibold mb-2">Selected Tickets: {selectedTickets.length}/25</p>
            {selectedTickets.length >= 20 && selectedTickets.length < 25 && (
              <p className="text-xs text-orange-500 font-semibold">⚠ Approaching maximum (25 tickets per PCN)</p>
            )}
            {selectedTickets.length > 0 && (
              <div className="text-sm mt-1">
                <span>Total Mass: {selectedTickets.reduce((sum, t) => sum + parseFloat(t.mass || t.netWeight || 0), 0).toFixed(2)} Kg</span>
                <span className="ml-4">Total Value: ${selectedTickets.reduce((sum, t) => sum + parseFloat(t.value || t.totalValue || 0), 0).toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="mb-4">
            <h5 className="font-semibold mb-2">Available Tickets (Select up to 25)</h5>
            <div className="max-h-96 overflow-y-auto space-y-4">
              {Object.values(groupedTickets).map((group) => (
                <div key={`${group.saleNumber}_${group.ps}`}>
                  <div className={`p-3 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className="font-semibold text-sm">Sale: {group.saleNumber} | PS: {group.ps} | {group.tickets.length} ticket(s)</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {group.tickets.map(ticket => (
                      <div
                        key={ticket.id}
                        onClick={() => handleTicketSelect(ticket)}
                        className={`p-3 border rounded cursor-pointer transition ${
                          selectedTickets.find(t => t.id === ticket.id)
                            ? 'border-green-600 bg-green-50 dark:bg-green-900/30'
                            : darkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">Ticket: {ticket.ticketNumber}</p>
                            <p className="text-xs text-gray-500">Farmer: {ticket.farmerName || ticket.firstName} | Grade: {ticket.gradeName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">{ticket.mass || ticket.netWeight} Kg</p>
                            <p className="text-xs">${parseFloat(ticket.value || ticket.totalValue || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(groupedTickets).length === 0 && (
                <p className="text-center text-gray-500 py-8">No available tickets. All tickets are assigned to PCNs or no tickets have been captured yet.</p>
              )}
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={createPCN}
              disabled={loadingPCN || selectedTickets.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loadingPCN ? 'Creating...' : 'Create PCN'}
            </button>
            <button onClick={resetForm} className={`px-6 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter Section */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-4 mb-6`}>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block mb-2 text-sm">Status</label>
            <select value={filter.status} onChange={(e) => setFilter({...filter, status: e.target.value})}
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}>
              <option>All</option>
              <option>Open</option>
              <option>Closed</option>
              <option>Approved</option>
            </select>
          </div>
          <div>
            <label className="block mb-2 text-sm">Sale Number</label>
            <input type="text" value={filter.saleNumber} onChange={(e) => setFilter({...filter, saleNumber: e.target.value})}
              placeholder="Filter by sale" className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} />
          </div>
          <div>
            <label className="block mb-2 text-sm">PS</label>
            <input type="text" value={filter.ps} onChange={(e) => setFilter({...filter, ps: e.target.value})}
              placeholder="Filter by PS" className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} />
          </div>
        </div>
      </div>

      {/* PCN List */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-x-auto`}>
        <table className="w-full">
          <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">PCN #</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Sale #</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">PS</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Tickets</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Mass (Kg)</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Value (USD)</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredPCNs.map(pcn => (
              <tr key={pcn.id} className={darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3 font-medium">{pcn.pcnNumber}</td>
                <td className="px-4 py-3">{pcn.saleNumber}</td>
                <td className="px-4 py-3">{pcn.ps}</td>
                <td className="px-4 py-3">{pcn.totalTickets}</td>
                <td className="px-4 py-3">{parseFloat(pcn.totalWeight || 0).toFixed(2)}</td>
                <td className="px-4 py-3">${parseFloat(pcn.totalValue || 0).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor(pcn.status)}`}>
                    {pcn.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex space-x-2 items-center">
                    <button onClick={() => setDetailPcn(pcn)} className="text-blue-600 hover:text-blue-800 text-sm" title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                    {isSupervisor && pcn.status === 'Open' && (
                      <button onClick={() => closePCN(pcn)} className="text-yellow-600 hover:text-yellow-800 text-sm font-medium">
                        Close
                      </button>
                    )}
                    {isSupervisor && pcn.status === 'Closed' && (
                      <button onClick={() => approvePCN(pcn)} className="text-green-600 hover:text-green-800 text-sm font-medium">
                        Approve
                      </button>
                    )}
                    {isSupervisor && pcn.status !== 'Approved' && (
                      <button onClick={() => deletePCN(pcn)} className="text-red-600 hover:text-red-800">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPCNs.length === 0 && (
          <div className="text-center py-8 text-gray-500">No PCNs found. Create one to get started.</div>
        )}
      </div>

      {/* Detail Modal */}
      {detailPcn && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-8 max-w-lg w-full`}>
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-bold text-lg">PCN Details</h4>
              <button onClick={() => setDetailPcn(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">PCN Number</span><span className="font-semibold">{detailPcn.pcnNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Sale Number</span><span>{detailPcn.saleNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">PS</span><span>{detailPcn.ps}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColor(detailPcn.status)}`}>{detailPcn.status}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Tickets</span><span>{detailPcn.totalTickets}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Farmers</span><span>{detailPcn.totalFarmers}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Mass</span><span>{parseFloat(detailPcn.totalWeight || 0).toFixed(2)} Kg</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Value</span><span>${parseFloat(detailPcn.totalValue || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{new Date(detailPcn.createdAt).toLocaleString()}</span></div>
              {detailPcn.closedAt && <div className="flex justify-between"><span className="text-gray-500">Closed</span><span>{new Date(detailPcn.closedAt).toLocaleString()} by {detailPcn.closedBy}</span></div>}
              {detailPcn.approvedAt && <div className="flex justify-between"><span className="text-gray-500">Approved</span><span>{new Date(detailPcn.approvedAt).toLocaleString()} by {detailPcn.approvedBy}</span></div>}
            </div>
            <button onClick={() => setDetailPcn(null)} className="mt-6 w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PCNList;
