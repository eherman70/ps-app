import { useState, useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { useStorage } from './hooks/useStorage';
import { Plus, Trash2, X } from 'lucide-react';

function PCNList() {
  const { darkMode, currentUser, activePS } = useAppContext();
  const { items: pcns, loading, saveItem, deleteItem } = useStorage('pcn');
  const { items: tickets } = useStorage('ticket');

  const activePSValue = currentUser.role === 'Admin' ? (activePS || 'All') : currentUser.ps;
  const [showForm, setShowForm] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [form, setForm] = useState({ pcnNumber: '', saleNumber: '', ps: '' });
  const [loadingPCN, setLoadingPCN] = useState(false);
  const [filter, setFilter] = useState({ status: 'All', saleNumber: '', ps: '' });

  const loadAvailableTickets = () => {
    return tickets.filter(t => !t.pcnNumber && (activePSValue === 'All' || t.ps === activePSValue));
  };

  const handleTicketSelect = (ticket) => {
    // Validation: Cannot mix sale numbers
    if (selectedTickets.length > 0) {
      const firstSaleNumber = selectedTickets[0].saleNumber;
      if (ticket.saleNumber !== firstSaleNumber) {
        return alert('Cannot mix sale numbers in one PCN');
      }
    }

    // Validation: Cannot mix PS
    if (selectedTickets.length > 0) {
      const firstPS = selectedTickets[0].ps;
      if (ticket.ps !== firstPS) {
        return alert('Cannot mix PS in one PCN');
      }
    }

    // Validation: Max 25 tickets
    if (selectedTickets.length >= 25) {
      return alert('Maximum 25 tickets per PCN');
    }

    // Check if already selected
    const exists = selectedTickets.find(t => t.id === ticket.id);
    if (exists) {
      setSelectedTickets(selectedTickets.filter(t => t.id !== ticket.id));
    } else {
      const newSelection = [...selectedTickets, ticket];
      setSelectedTickets(newSelection);

      // Auto-fill form with first ticket's data
      if (newSelection.length === 1) {
        setForm({
          pcnNumber: `PCN${Date.now()}`,
          saleNumber: ticket.saleNumber,
          ps: ticket.ps
        });
      }
    }
  };

  const createPCN = async () => {
    if (selectedTickets.length === 0) {
      return alert('Select at least one ticket');
    }

    if (!form.pcnNumber) {
      return alert('PCN number is required');
    }

    setLoadingPCN(true);

    try {
      // Calculate totals
      const totalBales = selectedTickets.length;
      const totalMass = selectedTickets.reduce((sum, t) => sum + parseFloat(t.mass || 0), 0);
      const totalValue = selectedTickets.reduce((sum, t) => sum + parseFloat(t.value || 0), 0);

      // Create PCN
      const pcnData = {
        ...form,
        id: form.pcnNumber,
        ticketCount: selectedTickets.length,
        tickets: selectedTickets.map(t => t.ticketNumber),
        totalBales,
        totalMass,
        totalValue,
        status: 'Open',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.username
      };

      await saveItem(form.pcnNumber, pcnData);

      // Update tickets with PCN number
      for (const ticket of selectedTickets) {
        const updatedTicket = { ...ticket, pcnNumber: form.pcnNumber };
        await window.storage.set(`ticket_${ticket.id}`, JSON.stringify(updatedTicket));
      }

      alert('PCN created successfully');
      resetForm();
    } catch (e) {
      console.error('Error creating PCN:', e);
      alert('Error creating PCN');
    }

    setLoadingPCN(false);
  };

  const resetForm = () => {
    setForm({ pcnNumber: '', saleNumber: '', ps: '' });
    setSelectedTickets([]);
    setShowForm(false);
  };

  const closePCN = async (pcnNumber) => {
    if (!confirm('Close this PCN? This action cannot be undone.')) return;

    try {
      const result = await window.storage.get(`pcn_${pcnNumber}`);
      if (result) {
        const pcn = JSON.parse(result.value);
        pcn.status = 'Closed';
        pcn.closedAt = new Date().toISOString();
        pcn.closedBy = currentUser.username;
        await window.storage.set(`pcn_${pcnNumber}`, JSON.stringify(pcn));
        alert('PCN closed successfully');
      }
    } catch (e) {
      console.error('Error closing PCN:', e);
      alert('Error closing PCN');
    }
  };

  const approvePCN = async (pcnNumber) => {
    if (!confirm('Approve this PCN?')) return;

    try {
      const result = await window.storage.get(`pcn_${pcnNumber}`);
      if (result) {
        const pcn = JSON.parse(result.value);
        if (pcn.status !== 'Closed') {
          return alert('PCN must be closed before approval');
        }
        pcn.status = 'Approved';
        pcn.approvedAt = new Date().toISOString();
        pcn.approvedBy = currentUser.username;
        await window.storage.set(`pcn_${pcnNumber}`, JSON.stringify(pcn));
        alert('PCN approved successfully');
      }
    } catch (e) {
      console.error('Error approving PCN:', e);
      alert('Error approving PCN');
    }
  };

  const deletePCN = async (pcnNumber) => {
    if (!confirm('Delete this PCN? Tickets will be released.')) return;

    try {
      const result = await window.storage.get(`pcn_${pcnNumber}`);
      if (result) {
        const pcn = JSON.parse(result.value);

        if (pcn.status === 'Approved') {
          return alert('Cannot delete approved PCN');
        }

        // Release tickets
        for (const ticketNum of pcn.tickets) {
          try {
            const ticketResult = await window.storage.get(`ticket_${ticketNum}`);
            if (ticketResult) {
              const ticket = JSON.parse(ticketResult.value);
              delete ticket.pcnNumber;
              await window.storage.set(`ticket_${ticketNum}`, JSON.stringify(ticket));
            }
          } catch (e) {
            console.error('Error releasing ticket:', e);
          }
        }

        await deleteItem(pcnNumber);
        alert('PCN deleted successfully');
      }
    } catch (e) {
      console.error('Error deleting PCN:', e);
      alert('Error deleting PCN');
    }
  };

  const viewPCNDetails = async (pcnNumber) => {
    try {
      const result = await window.storage.get(`pcn_${pcnNumber}`);
      if (result) {
        const pcn = JSON.parse(result.value);

        let details = `PCN Number: ${pcn.pcnNumber}\n`;
        details += `Sale Number: ${pcn.saleNumber}\n`;
        details += `PS: ${pcn.ps}\n`;
        details += `Status: ${pcn.status}\n`;
        details += `Tickets: ${pcn.ticketCount}\n`;
        details += `Total Mass: ${pcn.totalMass.toFixed(2)} Kg\n`;
        details += `Total Value: ${pcn.totalValue.toFixed(2)}\n`;
        details += `Created: ${new Date(pcn.createdAt).toLocaleString()}\n`;
        details += `Created By: ${pcn.createdBy}\n`;

        if (pcn.closedAt) {
          details += `Closed: ${new Date(pcn.closedAt).toLocaleString()}\n`;
          details += `Closed By: ${pcn.closedBy}\n`;
        }

        if (pcn.approvedAt) {
          details += `Approved: ${new Date(pcn.approvedAt).toLocaleString()}\n`;
          details += `Approved By: ${pcn.approvedBy}\n`;
        }

        details += `\nTickets: ${pcn.tickets.join(', ')}`;

        alert(details);
      }
    } catch (e) {
      console.error('Error viewing PCN:', e);
    }
  };

  const filteredPCNs = pcns
    .filter(pcn => activePSValue === 'All' || pcn.ps === activePSValue)
    .filter(pcn => {
      if (filter.status !== 'All' && pcn.status !== filter.status) return false;
      if (filter.saleNumber && !pcn.saleNumber.toLowerCase().includes(filter.saleNumber.toLowerCase())) return false;
      if (filter.ps && !pcn.ps.toLowerCase().includes(filter.ps.toLowerCase())) return false;
      return true;
    });

  // Group available tickets by sale number and PS
  const availableTickets = loadAvailableTickets();
  const groupedTickets = availableTickets.reduce((acc, ticket) => {
    const key = `${ticket.saleNumber}_${ticket.ps}`;
    if (!acc[key]) {
      acc[key] = {
        saleNumber: ticket.saleNumber,
        ps: ticket.ps,
        tickets: []
      };
    }
    acc[key].tickets.push(ticket);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">PCN Management</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Plus className="w-5 h-5" />
          <span>Create PCN</span>
        </button>
      </div>

      {/* Create PCN Form */}
      {showForm && (
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
              <input
                type="text"
                value={form.saleNumber}
                readOnly
                className={`w-full px-3 py-2 border rounded-lg bg-gray-100 ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>
            <div>
              <label className="block mb-2 text-sm">PS</label>
              <input
                type="text"
                value={form.ps}
                readOnly
                className={`w-full px-3 py-2 border rounded-lg bg-gray-100 ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              />
            </div>
          </div>

          <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
            <p className="text-sm font-semibold mb-2">Selected Tickets: {selectedTickets.length}/25</p>
            {selectedTickets.length > 0 && (
              <div className="text-sm">
                <p>Total Mass: {selectedTickets.reduce((sum, t) => sum + parseFloat(t.mass || 0), 0).toFixed(2)} Kg</p>
                <p>Total Value: ${selectedTickets.reduce((sum, t) => sum + parseFloat(t.value || 0), 0).toFixed(2)}</p>
              </div>
            )}
          </div>

          {/* Available Tickets by Sale Number & PS */}
          <div className="mb-4">
            <h5 className="font-semibold mb-2">Available Tickets (Select up to 25)</h5>
            <div className="max-h-96 overflow-y-auto">
              {Object.values(groupedTickets).map((group) => (
                <div key={`${group.saleNumber}_${group.ps}`} className="mb-4">
                  <div className={`p-3 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className="font-semibold">Sale: {group.saleNumber} | PS: {group.ps} | Tickets: {group.tickets.length}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {group.tickets.map(ticket => (
                      <div
                        key={ticket.id}
                        onClick={() => handleTicketSelect(ticket)}
                        className={`p-3 border rounded cursor-pointer transition ${
                          selectedTickets.find(t => t.id === ticket.id)
                            ? 'border-green-600 bg-green-50'
                            : darkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">Ticket: {ticket.ticketNumber}</p>
                            <p className="text-sm">Farmer: {ticket.farmerName} | Grade: {ticket.gradeName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{ticket.mass} Kg</p>
                            <p className="text-sm">${parseFloat(ticket.value).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {Object.keys(groupedTickets).length === 0 && (
                <p className="text-center text-gray-500 py-8">No available tickets. All tickets are assigned to PCNs.</p>
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
            <button
              onClick={resetForm}
              className={`px-6 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
            >
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
            <select
              value={filter.status}
              onChange={(e) => setFilter({...filter, status: e.target.value})}
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
            >
              <option>All</option>
              <option>Open</option>
              <option>Closed</option>
              <option>Approved</option>
            </select>
          </div>
          <div>
            <label className="block mb-2 text-sm">Sale Number</label>
            <input
              type="text"
              value={filter.saleNumber}
              onChange={(e) => setFilter({...filter, saleNumber: e.target.value})}
              placeholder="Filter by sale"
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
            />
          </div>
          <div>
            <label className="block mb-2 text-sm">PS</label>
            <input
              type="text"
              value={filter.ps}
              onChange={(e) => setFilter({...filter, ps: e.target.value})}
              placeholder="Filter by PS"
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
            />
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
          <tbody className="divide-y divide-gray-200">
            {filteredPCNs.map(pcn => (
              <tr key={pcn.id} className={darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3 font-medium">{pcn.pcnNumber}</td>
                <td className="px-4 py-3">{pcn.saleNumber}</td>
                <td className="px-4 py-3">{pcn.ps}</td>
                <td className="px-4 py-3">{pcn.ticketCount}</td>
                <td className="px-4 py-3">{pcn.totalMass.toFixed(2)}</td>
                <td className="px-4 py-3">${pcn.totalValue.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    pcn.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                    pcn.status === 'Closed' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {pcn.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => viewPCNDetails(pcn.pcnNumber)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="View Details"
                    >
                      View
                    </button>
                    {pcn.status === 'Open' && (
                      <button
                        onClick={() => closePCN(pcn.pcnNumber)}
                        className="text-yellow-600 hover:text-yellow-800 text-sm"
                        title="Close PCN"
                      >
                        Close
                      </button>
                    )}
                    {pcn.status === 'Closed' && (
                      <button
                        onClick={() => approvePCN(pcn.pcnNumber)}
                        className="text-green-600 hover:text-green-800 text-sm"
                        title="Approve PCN"
                      >
                        Approve
                      </button>
                    )}
                    {pcn.status !== 'Approved' && (
                      <button
                        onClick={() => deletePCN(pcn.pcnNumber)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete PCN"
                      >
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
          <div className="text-center py-8 text-gray-500">
            No PCNs found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}

export default PCNList;
