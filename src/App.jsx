import { useAppContext } from './context/AppContext';
import LoginScreen from './Components/LoginScreen.jsx';
import Header from './Components/Header.jsx';
import Sidebar from './Components/Sidebar.jsx';
import Dashboard from './Components/Dashboard.jsx';
import RegistrationModule from './Components/RegistrationModule.jsx';
import InputsManagement from './Components/InputsManagement.jsx';
import TobaccoSalesModule from './Components/TobaccoSalesModule.jsx';
import Reports from './Components/Reports.jsx';
import Settings from './Components/Settings.jsx';
import { Leaf } from 'lucide-react';

export default function TobaccoManagementSystem() {
  const { currentUser, darkMode, activeModule, isLoading } = useAppContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <Leaf className="w-16 h-16 text-green-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600 dark:text-gray-400">Initializing System...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className={`min-h-screen flex p-2 sm:p-4 print:p-0 ${darkMode ? 'bg-gray-900 text-white' : 'bg-slate-100 text-gray-900'}`}>
      <div className={`flex flex-1 rounded-3xl overflow-hidden shadow-2xl print:shadow-none print:rounded-none ${darkMode ? 'bg-gray-800' : 'bg-slate-50'}`}>
        <Sidebar />
        <div className="flex-1 flex overflow-hidden relative print:overflow-visible">
          <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible">
            <div className="print:hidden"><Header /></div>
            <main className="flex-1 px-8 pb-8 overflow-y-auto print:px-0 print:pb-0 print:overflow-visible">
              {activeModule === 'dashboard' && <Dashboard />}
              {activeModule === 'registration' && <RegistrationModule />}
              {activeModule === 'inputs' && <InputsManagement />}
              {activeModule === 'tobacco-sales' && <TobaccoSalesModule />}
              {activeModule === 'reports' && <Reports />}
              {activeModule === 'settings' && <Settings />}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
