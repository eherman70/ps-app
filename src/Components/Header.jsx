import { Search, Moon, Sun } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Header() {
  const { currentUser, darkMode, toggleDarkMode, testMode, setTestMode } = useAppContext();

  return (
    <header className="px-8 pt-8 pb-4 flex items-center justify-between z-10">
      <div className="flex-1 max-w-2xl">
        <div className={`flex items-center w-full rounded-2xl px-5 py-4 shadow-sm transition-shadow hover:shadow-md ${darkMode ? 'bg-gray-700' : 'bg-green-50'}`}>
          <Search className="w-5 h-5 text-gray-400 mr-4" />
          <input 
            type="text" 
            placeholder="Search farmers, tickets, sections..." 
            className="bg-transparent border-none outline-none w-full text-base dark:text-white placeholder-gray-400"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4 ml-6">
        {testMode && <span className="px-4 py-2 bg-yellow-500 text-white text-sm font-semibold rounded-xl">TEST MODE</span>}

        {currentUser.role === 'Supervisor' && (
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
    </header>
  );
}
