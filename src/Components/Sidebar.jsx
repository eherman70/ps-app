import { Home, Calendar, Leaf, FileText, BarChart3, Settings, LogOut } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

function Sidebar() {
  const { currentUser, activeModule, setActiveModule, darkMode, logout } = useAppContext();

  const moduleItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'registration', label: 'Registration', icon: Calendar },
    { id: 'inputs', label: 'Inputs', icon: Leaf },
    { id: 'tobacco-sales', label: 'Tobacco Sales', icon: FileText },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  // Role-based module access
  const items = moduleItems.filter(item => {
    if (currentUser.role === 'Clerk') {
      return ['dashboard', 'tobacco-sales'].includes(item.id);
    }
    return true;
  });

  return (
    <aside className={`w-64 flex flex-col ${darkMode ? 'bg-gray-900 border-r border-gray-700' : 'bg-slate-900'} text-white print:hidden`}>
      <div className="p-8 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-white text-slate-900 flex items-center justify-center text-3xl font-bold mb-4 shadow-lg border-4 border-white">
          {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
        </div>
        <h2 className="font-semibold text-lg tracking-wide">{currentUser.fullName}</h2>
        <p className="text-sm text-gray-400 uppercase tracking-widest mt-1 text-[10px]">{currentUser.role}</p>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-600 shadow-md transform scale-[1.02]' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'currentColor'}`} />
              <span className={`font-medium ${isActive ? 'text-white' : ''}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 px-4 space-y-2 mt-auto">
         <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
           <Settings className="w-5 h-5 currentColor" />
           <span className="font-medium">Settings</span>
         </button>
         <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
           <LogOut className="w-5 h-5 currentColor" />
           <span className="font-medium">Log out</span>
         </button>
      </div>
    </aside>
  );
}

export default Sidebar;

