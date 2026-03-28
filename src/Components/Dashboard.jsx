import { useMemo } from 'react';
import { Users, Calendar, FileText, LayoutDashboard, Leaf, Cloud, Heart, Folder, Share2, MoreHorizontal, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useStorage } from '../hooks/useStorage';
import { filterItemsByPS, getScopedPS } from '../utils';

function Dashboard() {
  const { darkMode, setActiveModule, setActiveTabOverride, currentUser, activePS } = useAppContext();
  const { items: farmers } = useStorage('farmer');
  const { items: seasons } = useStorage('season');
  const { items: grades } = useStorage('grade');
  const { items: issuedInputs } = useStorage('issuedinput');
  const { items: tickets } = useStorage('ticket');
  const { items: users } = useStorage('user');

  const scopedPS = getScopedPS(currentUser, activePS);

  const scopedFarmers = useMemo(() => filterItemsByPS(farmers, scopedPS), [farmers, scopedPS]);
  const scopedInputs = useMemo(() => filterItemsByPS(issuedInputs, scopedPS), [issuedInputs, scopedPS]);
  const scopedTickets = useMemo(() => filterItemsByPS(tickets, scopedPS), [tickets, scopedPS]);

  const stats = useMemo(() => ({
    farmers: scopedFarmers.length,
    seasons: seasons.length,
    grades: grades.length,
    inputs: scopedInputs.length,
    tickets: scopedTickets.length,
  }), [scopedFarmers.length, seasons.length, grades.length, scopedInputs.length, scopedTickets.length]);

  const last7DaysTickets = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const today = new Date();
    today.setHours(0,0,0,0);
    scopedTickets.forEach(t => {
      const d = new Date(t.captureDate || t.createdAt || t.saleDate);
      const diffTime = today - d;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        counts[6 - diffDays]++;
      }
    });
    const maxCount = Math.max(...counts, 1);
    return counts.map(c => Math.round((c / maxCount) * 100));
  }, [scopedTickets]);

  const recentGrowthText = useMemo(() => {
    if (scopedFarmers.length === 0) return "No registrations yet.";
    return `System has ${scopedFarmers.length} registered farmers across ${seasons.length} seasons.`;
  }, [scopedFarmers.length, seasons.length]);

  const farmersWithInputs = useMemo(() => new Set(scopedInputs.map(i => i.farmerId)).size, [scopedInputs]);
  const activeFarmers = useMemo(() => new Set([...scopedInputs.map(i=>i.farmerId), ...scopedTickets.map(t=>t.farmerId)]).size, [scopedInputs, scopedTickets]);
  const inputsPct = scopedFarmers.length > 0 ? Math.round((farmersWithInputs / scopedFarmers.length) * 100) : 0;
  const activePct = scopedFarmers.length > 0 ? Math.round((activeFarmers / scopedFarmers.length) * 100) : 0;

  const scopedUsers = useMemo(() => filterItemsByPS(users, scopedPS), [users, scopedPS]);
  const activeUsersCount = scopedUsers.filter(u => u.status === 'Active' || !u.status).length;
  const clerkCount = scopedUsers.filter(u => u.role === 'Capture Clerk').length;
  const supervisorCount = scopedUsers.filter(u => u.role === 'Supervisor' || u.role === 'Admin').length;
  
  const totalSegmentedUsers = Math.max(clerkCount + supervisorCount, 1);
  const clerkPct = Math.round((clerkCount / totalSegmentedUsers) * 100);
  const supervisorPct = Math.round((supervisorCount / totalSegmentedUsers) * 100);
  const circleCircumference = 2 * Math.PI * 40;
  const clerkDash = (clerkPct / 100) * circleCircumference;
  const supervisorDash = (supervisorPct / 100) * circleCircumference;

  const categories = [
    { label: 'Farmers', value: stats.farmers, icon: Users, color: 'bg-indigo-500', targetModule: 'registration', targetTab: 'farmers' },
    { label: 'Seasons', value: stats.seasons, icon: Calendar, color: 'bg-teal-500', targetModule: 'registration', targetTab: 'seasons' },
    { label: 'Grades', value: stats.grades, icon: FileText, color: 'bg-rose-500', targetModule: 'registration', targetTab: 'grades' },
    { label: 'Tickets', value: stats.tickets, icon: FileText, color: 'bg-blue-500', targetModule: 'tobacco-sales', targetTab: null },
  ];

  const handleNavigate = (targetModule, targetTab) => {
    if (targetTab) {
      setActiveTabOverride(targetTab);
    }
    setActiveModule(targetModule);
  };

  const quickLinks = [
    { label: 'Registration', count: stats.farmers, icon: LayoutDashboard, moduleId: 'registration' },
    { label: 'Inputs', count: stats.inputs, icon: Leaf, moduleId: 'inputs' },
    { label: 'Sales', count: stats.tickets, icon: Cloud, moduleId: 'tobacco-sales' },
    { label: 'Reports', count: 4, icon: Folder, moduleId: 'reports' },
  ];

  return (
    <div className="w-full h-full pb-10">
      
      {/* Categories */}
      <h2 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Categories</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {categories.map((card, i) => {
          const Icon = card.icon;
          return (
            <div 
              key={i} 
              onClick={() => handleNavigate(card.targetModule, card.targetTab)}
              className={`${card.color} rounded-3xl p-5 text-white shadow-md relative overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-lg cursor-pointer`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Icon className="w-6 h-6" />
                </div>
                {i === 0 && <Heart className="w-5 h-5 fill-yellow-400 text-yellow-400" />}
              </div>
              <h3 className="font-semibold text-lg">{card.label}</h3>
              <p className="text-white/80 text-sm">{card.value} items</p>
            </div>
          );
        })}
      </div>

      {/* Files / Quick Links */}
      <h2 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Modules</h2>
      <div className="flex overflow-x-auto pb-4 space-x-4 mb-4" style={{ scrollbarWidth: 'none' }}>
        {quickLinks.map((link, i) => {
          const Icon = link.icon;
          return (
            <div 
              key={i} 
              onClick={() => setActiveModule(link.moduleId)}
              className={`flex-shrink-0 w-40 rounded-3xl p-5 shadow-sm cursor-pointer transition-all hover:shadow-md ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-green-50'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <Icon className={`w-6 h-6 ${darkMode ? 'text-blue-500' : 'text-indigo-600'}`} />
              </div>
              <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>{link.label}</h3>
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{link.count} items</p>
              <div className={`w-8 border-b-2 mt-4 ${darkMode ? 'border-indigo-500' : 'border-teal-500'}`}></div>
            </div>
          );
        })}
        {/* Add logic */}
         <div className={`flex-shrink-0 flex items-center justify-center w-24 rounded-3xl p-5 shadow-sm cursor-pointer transition-all hover:bg-green-100 ${darkMode ? 'bg-gray-800 border-2 border-dashed border-gray-600' : 'bg-green-50 border-2 border-dashed border-green-200'}`}>
            <Plus className={`w-8 h-8 ${darkMode ? 'text-gray-500' : 'text-blue-500'}`} />
         </div>
      </div>

      {/* Analytics Overview */}
      <h2 className={`text-lg font-bold mb-4 mt-8 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Analytics Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Sales Analytics */}
        <div className={`p-6 rounded-3xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>Sales Volume (7 Days)</h3>
            <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">{scopedTickets.length > 0 ? 'Active' : 'No Data'}</span>
          </div>
          <div className="flex items-end space-x-2 h-32 mb-4">
            {last7DaysTickets.map((height, idx) => (
              <div key={idx} className="w-full flex flex-col justify-end h-full group" title={`Day ${7 - idx} ago: ${height}% capacity`}>
                <div 
                  className={`w-full bg-blue-100 dark:bg-gray-700 rounded-t-md transition-all relative ${height > 0 ? 'group-hover:bg-blue-300' : ''}`} 
                  style={{ height: `${Math.max(height, 5)}%` }}
                >
                  <div className={`absolute bottom-0 w-full bg-blue-500 rounded-t-md transition-all ${idx === 6 ? 'bg-indigo-500 h-full' : 'h-full'}`}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Tickets</p>
              <p className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stats.tickets || 0}</p>
            </div>
            <Cloud className={`w-6 h-6 ${darkMode ? 'text-gray-500' : 'text-slate-300'}`} />
          </div>
        </div>

        {/* Farmers Analytics */}
        <div className={`p-6 rounded-3xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>Farmer Growth & Activity</h3>
            <Users className={`w-5 h-5 ${darkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
          </div>
          
          <div className="space-y-4 mb-6">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Registered</span>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stats.farmers}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Inputs Received</span>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{farmersWithInputs}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${inputsPct}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Active in System</span>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{activeFarmers}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${activePct}%` }}></div>
              </div>
            </div>
          </div>
          
          <div className={`p-4 rounded-2xl ${darkMode ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
            <p className={`text-xs ${darkMode ? 'text-indigo-300' : 'text-indigo-800'}`}>{recentGrowthText}</p>
          </div>
        </div>

        {/* Users Analytics */}
        <div className={`p-6 rounded-3xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>System Usage</h3>
            <span className="text-xs font-semibold text-white bg-slate-800 px-2 py-1 rounded-full">All Time</span>
          </div>

          <div className="flex justify-center items-center py-6 relative">
            <div className="w-32 h-32 relative flex items-center justify-center">
              <svg width="128" height="128" viewBox="0 0 100 100" className="transform -rotate-90 absolute text-slate-100 dark:text-gray-700">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="12" />
                {clerkDash > 0 && <circle cx="50" cy="50" r="40" fill="transparent" stroke="#3b82f6" strokeWidth="12" strokeDasharray={`${clerkDash} ${circleCircumference}`} strokeDashoffset="0" className="transition-all duration-1000 ease-in-out" />}
                {supervisorDash > 0 && <circle cx="50" cy="50" r="40" fill="transparent" stroke="#14b8a6" strokeWidth="12" strokeDasharray={`${supervisorDash} ${circleCircumference}`} strokeDashoffset={`-${clerkDash}`} className="transition-all duration-1000 ease-in-out" />}
              </svg>
              
              <div className="text-center z-10">
                <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{activeUsersCount || 0}</p>
                <p className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Users</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs mt-2">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>clerks ({clerkCount})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-teal-500"></span>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>supervisors ({supervisorCount})</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default Dashboard;
