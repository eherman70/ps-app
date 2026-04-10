import { Search, Moon, Sun } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Header() {
  const { currentUser, darkMode, toggleDarkMode, testMode, setTestMode } = useAppContext();

  return (
    <header className="px-8 pt-6 pb-4 flex items-center justify-between z-10">
      <div className="flex-1 flex items-center space-x-2">
        <h1 className={`text-xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>
          Tobacco Farmer <span className="text-green-600">Management System</span>
        </h1>
      </div>

      <div className="flex items-center space-x-4 ml-6">
        {testMode && <span className="px-4 py-2 bg-yellow-500 text-white text-sm font-semibold rounded-xl">TEST MODE</span>}

        {currentUser.role === 'supervisor' && (
          <button
            onClick={() => setTestMode(!testMode)}
            className={`px-5 py-3 rounded-2xl text-sm font-semibold transition-all ${testMode ? 'bg-yellow-600 text-white' : darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-green-50 shadow-sm hover:shadow-md text-gray-700'}`}
          >
            {testMode ? 'Exit Test' : 'Enable Test'}
          </button>
        )}

        <button
          onClick={toggleDarkMode}
          className={`p-4 rounded-2xl transition-all shadow-sm hover:shadow-md ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-green-50 hover:bg-green-100'}`}
        >
          {darkMode ? <Sun className="w-6 h-6 text-yellow-500" /> : <Moon className="w-6 h-6 text-slate-900" />}
        </button>
      </div>
    </header >
  );
}
