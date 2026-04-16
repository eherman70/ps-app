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
  const isPreLinked = currentUser.ps && currentUser.ps !== 'All';
  // Supervisors don't have access to societies, so their default should be seasons if supervisor, otherwise farmers
  // Pre-linked users (even Admin) skip societies since they're already associated with one
  const [activeTab, setActiveTab] = useState(activeTabOverride || (isAdmin && !isPreLinked ? 'societies' : (isAdminOrSupervisor ? 'seasons' : 'farmers')));

  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
      setActiveTabOverride(null); // clear it after consuming
    }
  }, [activeTabOverride, setActiveTabOverride]);

  return (
    <div>
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
