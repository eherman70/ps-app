import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useStorage } from '../hooks/useStorage';
import { Search, Trash2, Edit3, Filter } from 'lucide-react';
import { filterItemsByPS, getScopedPS } from '../utils';

function TicketList() {
  const { darkMode, currentUser, activePS } = useAppContext();
  const { items: tickets, loading, deleteItem } = useStorage('ticket');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSale, setFilterSale] = useState('');

  const isSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';
  const scopedPS = getScopedPS(currentUser, activePS);
  const scopedTickets = filterItemsByPS(tickets, scopedPS);

  const filteredTickets = scopedTickets.filter(t => {
    const matchesSearch = 
      t.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.farmerNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSale = !filterSale || t.saleNumber === filterSale;
    
    return matchesSearch && matchesSale;
  });

  const handleDelete = async (id) => {
    if (!isSupervisor) return alert('Only supervisors can delete tickets');
    if (confirm('Are you sure you want to delete this ticket?')) {
      try {
        await deleteItem(id);
      } catch (e) {
        alert('Error deleting ticket: ' + e.message);
      }
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading tickets...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            className={`w-full pl-10 pr-4 py-2 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} outline-none focus:ring-2 focus:ring-green-500`}
            placeholder="Search by Ticket #, Farmer # or Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select 
            className={`px-4 py-2 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} outline-none`}
            value={filterSale}
            onChange={(e) => setFilterSale(e.target.value)}
          >
            <option value="">All Sales</option>
            {Array.from(new Set(scopedTickets.map(t => t.saleNumber))).filter(Boolean).sort().map(sn => (
              <option key={sn} value={sn}>Sale #{sn}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={`overflow-hidden rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
              <tr>
                <th className="px-6 py-4 font-bold">Ticket #</th>
                <th className="px-6 py-4 font-bold">Farmer</th>
                <th className="px-6 py-4 font-bold">Grade</th>
                <th className="px-6 py-4 font-bold">Net (Kg)</th>
                <th className="px-6 py-4 font-bold">Value (USD)</th>
                <th className="px-6 py-4 font-bold">Sale</th>
                <th className="px-6 py-4 font-bold">Date</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filteredTickets.map(ticket => (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td className="px-6 py-4 font-bold text-green-600">{ticket.ticketNumber}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold">{ticket.firstName} {ticket.lastName}</div>
                    <div className="text-[10px] text-gray-500">{ticket.farmerNumber}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium">{ticket.gCode || ticket.grade_code}</span>
                    <div className="text-[10px] text-gray-400">{ticket.gradeName}</div>
                  </td>
                  <td className="px-6 py-4 font-bold">{parseFloat(ticket.netWeight || ticket.mass || 0).toFixed(1)}</td>
                  <td className="px-6 py-4 font-bold text-indigo-600">${parseFloat(ticket.totalValue || ticket.value || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-blue-600 shadow-sm text-white text-[10px] font-bold rounded-lg uppercase">
                      Sale #{ticket.saleNumber}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs opacity-60">
                    {ticket.captureDate || new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                       {isSupervisor && (
                         <button 
                            onClick={() => handleDelete(ticket.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            title="Delete Ticket"
                         >
                            <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500 italic">
                    No tickets found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TicketList;
