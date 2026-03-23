import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import SeasonManagement from '../SeasonManagement';
import GradeManagement from '../GradeManagement';
import MarketCenterManagement from '../MarketCenterManagement';
import UserManagement from '../UserManagement';
import FarmerManagement from '../FarmerManagement';
import PrimarySocietyManagement from '../PrimarySocietyManagement';

function RegistrationModule() {
  const { currentUser, darkMode } = useAppContext();
  const isAdminOrSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';
  const [activeTab, setActiveTab] = useState(isAdminOrSupervisor ? 'seasons' : 'farmers');

  const tabs = [
    { id: 'societies', label: 'Societies', sup: true },
    { id: 'seasons', label: 'Seasons', sup: true },
    { id: 'grades', label: 'Grades', sup: true },
    { id: 'markets', label: 'Market Centers', sup: true },
    { id: 'users', label: 'Users', sup: true },
    { id: 'farmers', label: 'Farmers', sup: false },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Registration</h2>

      <div className="mb-6 overflow-x-auto">
        <div className={`flex space-x-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          {tabs.filter(t => !t.sup || isAdminOrSupervisor).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === tab.id ? 'border-b-2 border-green-600 text-green-600' : darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'societies' && <PrimarySocietyManagement />}
      {activeTab === 'seasons' && <SeasonManagement />}
      {activeTab === 'grades' && <GradeManagement />}
      {activeTab === 'markets' && <MarketCenterManagement />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'farmers' && <FarmerManagement />}
    </div>
  );
}

export default RegistrationModule;
