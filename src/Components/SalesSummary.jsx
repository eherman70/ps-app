import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useStorage } from '../hooks/useStorage';
import TicketCapture from '../TicketCapture';
import { Play } from 'lucide-react';
import { filterItemsByPS, getScopedPS } from '../utils';

function SalesSummary() {
  const { darkMode, currentUser, activePS } = useAppContext();
  const { items: tickets } = useStorage('ticket');
  const { items: saleNumbers } = useStorage('salenumber');
  const { items: marketCenters } = useStorage('marketcenter');
  
  const [capturingSale, setCapturingSale] = useState(null);
  const scopedPS = getScopedPS(currentUser, activePS);
  const scopedTickets = filterItemsByPS(tickets, scopedPS);
  const scopedSaleNumbers = filterItemsByPS(saleNumbers, scopedPS);

  if (capturingSale) {
    return (
      <TicketCapture 
        onClose={() => setCapturingSale(null)} 
        prefilledMarketCenter={capturingSale.marketCenterId}
        prefilledSaleNumber={capturingSale.saleNumber}
        prefilledSaleNumberId={capturingSale.id}
      />
    );
  }

  // Aggregate stats per sale number
  const salesStats = scopedSaleNumbers.map(sn => {
    // Filter tickets strictly to this sale number by UUID
    const saleTickets = scopedTickets.filter(t => t.saleNumberId === sn.id);
    const bales = saleTickets.length;
    
    // Sum mass and value - using both legacy and new field names for robustness
    const mass = saleTickets.reduce((sum, t) => sum + parseFloat(t.netWeight || t.mass || 0), 0);
    const value = saleTickets.reduce((sum, t) => sum + parseFloat(t.totalValue || t.value || 0), 0);
    
    // Calculate true average price
    const avgPrice = mass > 0 ? value / mass : 0;
    
    // Get market center name safely
    const mc = marketCenters.find(m => m.id === sn.marketCenterId);

    return {
      ...sn,
      marketCenterName: mc ? mc.name : 'Unknown',
      bales,
      mass: mass.toFixed(2),
      value: value.toFixed(2),
      avgPrice: avgPrice.toFixed(2)
    };
  }).filter(stat => scopedPS === 'All' || stat.bales > 0 || stat.status === 'Active');

  return (
    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
      <div className={`p-4 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
        <h3 className="font-semibold text-lg">Tobacco Sales Overview</h3>
      </div>
      <div className="overflow-x-auto text-sm">
        <table className="w-full text-left">
          <thead className={`text-xs uppercase ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
            <tr>
              <th className="px-6 py-4 font-semibold">Market Center</th>
              <th className="px-6 py-4 font-semibold">Sale Number</th>
              <th className="px-6 py-4 font-semibold">Total Bales</th>
              <th className="px-6 py-4 font-semibold">Total Mass (Kg)</th>
              <th className="px-6 py-4 font-semibold">Gross Value (USD)</th>
              <th className="px-6 py-4 font-semibold">Avg Price (USD/Kg)</th>
              <th className="px-6 py-4 font-semibold text-center">Capture Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {salesStats.map(stat => (
              <tr key={stat.id} className={`hover:${darkMode ? 'bg-gray-750' : 'bg-gray-50'} transition`}>
                <td className="px-6 py-4">{stat.marketCenterName}</td>
                <td className="px-6 py-4 font-bold text-green-600 dark:text-green-400">{stat.saleNumber}</td>
                <td className="px-6 py-4 font-medium">{stat.bales}</td>
                <td className="px-6 py-4">{stat.mass}</td>
                <td className="px-6 py-4 font-medium">${stat.value}</td>
                <td className="px-6 py-4">${stat.avgPrice}</td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => setCapturingSale(stat)}
                    className="flex items-center justify-center w-full space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm text-xs font-semibold transition"
                  >
                    <Play className="w-3 h-3" />
                    <span>Open Capture Mode</span>
                  </button>
                </td>
              </tr>
            ))}
            {salesStats.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500 italic">
                  No sales configured. Create a PCN/Sale Number first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SalesSummary;
