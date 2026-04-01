import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import SaleNumberManagement from '../SaleNumberManagement';
import SalesSummary from './SalesSummary';
import TicketList from './TicketList';
import PCNList from '../PCNList';
import PaymentModule from '../PaymentModule';

function TobaccoSalesModule() {
  const { currentUser, activeTabOverride, setActiveTabOverride } = useAppContext();
  const isSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';
  const defaultTab = isSupervisor ? 'register' : 'capture';
  const [activeTab, setActiveTab] = useState(activeTabOverride || defaultTab);

  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
      setActiveTabOverride(null);
    }
  }, [activeTabOverride, setActiveTabOverride]);



  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Tobacco Sales</h2>



      {activeTab === 'register' && <SaleNumberManagement />}
      {activeTab === 'capture' && <SalesSummary />}
      {activeTab === 'tickets' && <TicketList />}
      {activeTab === 'pcn' && <PCNList />}
      {activeTab === 'payments' && <PaymentModule />}
    </div>
  );
}

export default TobaccoSalesModule;
