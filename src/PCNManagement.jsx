import { useState } from 'react';
import { useAppContext } from './context/AppContext';
import SaleNumberManagement from './SaleNumberManagement';
import PCNList from './PCNList';

function PCNManagement() {
  const [activeTab, setActiveTab] = useState('salenumbers');

  return (
    <div>
      <h3 className="text-xl font-semibold mb-6">PCN & Sale Management</h3>

      <div className="mb-6">
        <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('salenumbers')}
            className={`px-6 py-3 font-medium ${activeTab === 'salenumbers' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-600 dark:text-gray-400'}`}
          >
            Sale Numbers
          </button>
          <button
            onClick={() => setActiveTab('pcns')}
            className={`px-6 py-3 font-medium ${activeTab === 'pcns' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-600 dark:text-gray-400'}`}
          >
            PCN Management
          </button>
        </div>
      </div>

      {activeTab === 'salenumbers' && <SaleNumberManagement />}
      {activeTab === 'pcns' && <PCNList />}
    </div>
  );
}

export default PCNManagement;
