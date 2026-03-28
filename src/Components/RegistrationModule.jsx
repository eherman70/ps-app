import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import SeasonManagement from '../SeasonManagement';
import GradeManagement from '../GradeManagement';
import MarketCenterManagement from '../MarketCenterManagement';
import UserManagement from '../UserManagement';
import FarmerManagement from '../FarmerManagement';
import PrimarySocietyManagement from '../PrimarySocietyManagement';

function RegistrationModule() {
  const { currentUser, darkMode, activeTabOverride, setActiveTabOverride } = useAppContext();
  const isAdminOrSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';
  const isAdmin = currentUser.role === 'Admin';
  // Supervisors don't have access to societies, so their default should be seasons if supervisor, otherwise farmers
  const [activeTab, setActiveTab] = useState(activeTabOverride || (isAdmin ? 'societies' : (isAdminOrSupervisor ? 'seasons' : 'farmers')));

  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
      setActiveTabOverride(null); // clear it after consuming
    }
  }, [activeTabOverride, setActiveTabOverride]);

  const tabs = [
    { id: 'societies', label: 'Societies', requireAdmin: true },
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
          {tabs.filter(t => {
            if (t.requireAdmin && !isAdmin) return false;
            if (t.sup && !isAdminOrSupervisor) return false;
            return true;
          }).map(tab => (
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
