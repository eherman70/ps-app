import { useState } from 'react';
import { Home, Calendar, Leaf, FileText, BarChart3, Settings, LogOut, FlaskConical, ChevronDown, ChevronRight, ClipboardList, Tag, Banknote, List, Briefcase, Package, Send, Building, CalendarDays, Award, MapPin, Users, User, FileSpreadsheet, Star } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

function Sidebar() {
  const { currentUser, activeModule, setActiveModule, darkMode, logout, testMode } = useAppContext();

  const isSupervisor = currentUser.role === 'Supervisor' || currentUser.role === 'Admin';
  const isAdmin = currentUser.role === 'Admin';
  const isClerk = currentUser.role === 'Clerk';

  const moduleItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { 
      id: 'registration', 
      label: 'Registration', 
      icon: Calendar,
      subMenu: [
        { id: 'societies', label: 'Societies', requireAdmin: true, icon: Building },
        { id: 'seasons', label: 'Seasons', supOnly: true, icon: CalendarDays },
        { id: 'grades', label: 'Grades', supOnly: true, icon: Award },
        { id: 'markets', label: 'Market Centers', supOnly: true, icon: MapPin },
        { id: 'users', label: 'Users', supOnly: true, icon: Users },
        { id: 'farmers', label: 'Farmers', icon: User }
      ]
    },
    { 
      id: 'inputs', 
      label: 'Inputs', 
      icon: Leaf, 
      supOnly: false,
      subMenu: [
        { id: 'types', label: 'Register Inputs/Advances', icon: Package },
        { id: 'issue', label: 'Issue Inputs/Advances', icon: Send }
      ]
    },
    { 
      id: 'tobacco-sales', 
      label: 'Tobacco Sales', 
      icon: FileText,
      subMenu: [
        { id: 'register', label: 'Register Sale', supOnly: true, icon: ClipboardList },
        { id: 'capture', label: 'Capture Sale', icon: Tag },
        { id: 'tickets', label: 'Detailed Tickets', icon: List },
        { id: 'pcn', label: 'PCN Management', supOnly: true, icon: Briefcase },
        { id: 'payments', label: 'Payments', supOnly: true, icon: Banknote }
      ]
    },
    { 
      id: 'reports', 
      label: 'Reports', 
      icon: BarChart3,
      subMenu: [
        { id: 'sales', label: 'Sales', icon: Leaf },
        { id: 'farmers', label: 'Farmers', icon: Users },
        { id: 'inputs', label: 'Inputs', icon: FileSpreadsheet },
        { id: 'grades', label: 'Grades', icon: Tag },
        { id: 'premium', label: 'Premium', icon: Star },
        { id: 'payments', label: 'Payments', supOnly: true, icon: Banknote }
      ]
    },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Role-based module access
  const items = moduleItems.filter(item => {
    if (isClerk) {
      return ['dashboard', 'registration', 'tobacco-sales', 'settings'].includes(item.id);
    }
    return true;
  });

  const { setActiveTabOverride } = useAppContext();
  const [openMenus, setOpenMenus] = useState({});

  const handleSubMenuClick = (moduleId, tabId) => {
    setActiveTabOverride(tabId);
    setActiveModule(moduleId);
  };

  return (
    <aside className={`w-64 flex flex-col ${darkMode ? 'bg-gray-900 border-r border-gray-700' : 'bg-slate-900'} text-white print:hidden`}>
      <div className="p-8 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-white text-slate-900 flex items-center justify-center text-3xl font-bold mb-4 shadow-lg border-4 border-white">
          {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
        </div>
        <h2 className="font-semibold text-lg tracking-wide text-center leading-tight">{currentUser.fullName}</h2>
        <p className="text-sm text-gray-400 uppercase tracking-widest mt-1 text-[10px]">{currentUser.role}</p>
        {currentUser.ps && currentUser.ps !== 'All' && (
          <p className="text-xs text-blue-400 mt-1 truncate max-w-full px-2 text-center">{currentUser.ps}</p>
        )}
        {testMode && (
          <span className="mt-2 px-2 py-0.5 bg-yellow-500 text-black text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1">
            <FlaskConical className="w-3 h-3" /> Test Mode
          </span>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          const isMenuOpen = openMenus[item.id] === undefined ? isActive : openMenus[item.id];
          
          return (
            <div key={item.id} className="w-full">
              <button
                onClick={() => {
                  if (isActive) {
                    if (item.subMenu) {
                      setOpenMenus(prev => ({ ...prev, [item.id]: !isMenuOpen }));
                    }
                  } else {
                    setActiveModule(item.id);
                    if (item.subMenu) {
                      setOpenMenus({ [item.id]: true });
                    } else {
                      setOpenMenus({});
                    }
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 shadow-md transform scale-[1.02]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'currentColor'}`} />
                  <span className={`font-medium ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                </div>
                {item.subMenu && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenus(prev => ({ ...prev, [item.id]: !isMenuOpen }));
                    }}
                    className="p-1 rounded-md hover:bg-white/10 transition-colors"
                  >
                    {isMenuOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                )}
              </button>
              
              {item.subMenu && isMenuOpen && (
                <div className="pl-12 pr-4 py-2 space-y-1">
                  {item.subMenu.map(sub => {
                    if (sub.supOnly && !isSupervisor) return null;
                    if (sub.requireAdmin && !isAdmin) return null;
                    const SubIcon = sub.icon;
                    const isSubActive = isActive && useAppContext().activeTabOverride === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleSubMenuClick(item.id, sub.id)}
                        className={`flex items-center space-x-3 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          isSubActive
                            ? 'text-white font-semibold' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {SubIcon && <SubIcon className={`w-4 h-4 ${isSubActive ? 'text-white' : 'opacity-70'}`} />}
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 px-4 mt-auto">
        <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
          <LogOut className="w-5 h-5 currentColor" />
          <span className="font-medium">Log out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
