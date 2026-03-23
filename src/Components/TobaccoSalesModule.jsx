import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import SalesSummary from './SalesSummary';
import TicketList from './TicketList';
import PCNManagement from '../PCNManagement';
import PaymentModule from '../PaymentModule';

function TobaccoSalesModule() {
  const { currentUser } = useAppContext();
  const [activeTab, setActiveTab] = useState('sales');

  const tabs = [
    { id: 'sales', label: 'Tobacco Sales' },
    { id: 'tickets', label: 'Detailed Tickets' },
    { id: 'pcn', label: 'PCN', sup: true },
    { id: 'payments', label: 'Payments', sup: true },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Tobacco Sales</h2>

      <div className="mb-6">
        <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
          {tabs.filter(t => !t.sup || currentUser.role === 'Supervisor' || currentUser.role === 'Admin').map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium ${activeTab === tab.id ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-600 dark:text-gray-400'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'sales' && <SalesSummary />}
      {activeTab === 'tickets' && <TicketList />}
      {activeTab === 'pcn' && <PCNManagement />}
      {activeTab === 'payments' && <PaymentModule />}
    </div>
  );
}

export default TobaccoSalesModule;
