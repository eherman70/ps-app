import { useState, useEffect } from 'react';
import { Users, Calendar, FileText, LayoutDashboard, Leaf, Cloud, Heart, Folder, Share2, MoreHorizontal, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

function Dashboard() {
  const { darkMode, setActiveModule } = useAppContext();
  const [stats, setStats] = useState({ farmers: 0, seasons: 0, grades: 0, inputs: 0, tickets: 0 });

  useEffect(() => {
    const loadStats = async () => {
      try {
        let farmers = 0, seasons = 0, grades = 0, inputs = 0, tickets = 0;
        const fKeys = await window.storage.list('farmer_');
        if (fKeys?.keys) farmers = fKeys.keys.length;
        const sKeys = await window.storage.list('season_');
        if (sKeys?.keys) seasons = sKeys.keys.length;
        const gKeys = await window.storage.list('grade_');
        if (gKeys?.keys) grades = gKeys.keys.length;
        const iKeys = await window.storage.list('issuedinput_');
        if (iKeys?.keys) inputs = iKeys.keys.length;
        const tKeys = await window.storage.list('ticket_');
        if (tKeys?.keys) tickets = tKeys.keys.length;
        
        setStats({ farmers, seasons, grades, inputs, tickets });
      } catch (error) {
        console.error('Stats error:', error);
      }
    };
    loadStats();
  }, []);

  const categories = [
    { label: 'Farmers', value: stats.farmers, icon: Users, color: 'bg-indigo-500' },
    { label: 'Seasons', value: stats.seasons, icon: Calendar, color: 'bg-teal-500' },
    { label: 'Grades', value: stats.grades, icon: FileText, color: 'bg-rose-500' },
    { label: 'Tickets', value: stats.tickets, icon: FileText, color: 'bg-blue-500' },
  ];

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
            <div key={i} className={`${card.color} rounded-3xl p-5 text-white shadow-md relative overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-lg`}>
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
            <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>Sales Volume</h3>
            <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>
          </div>
          <div className="flex items-end space-x-2 h-32 mb-4">
            {/* CSS Bar Chart Mockup */}
            {[40, 70, 45, 90, 60, 100, 85].map((height, idx) => (
              <div key={idx} className="w-full flex flex-col justify-end h-full group">
                <div 
                  className="w-full bg-blue-100 dark:bg-gray-700 rounded-t-md transition-all group-hover:bg-blue-300 relative" 
                  style={{ height: `${height}%` }}
                >
                  <div className={`absolute bottom-0 w-full bg-blue-500 rounded-t-md transition-all ${idx === 5 ? 'bg-indigo-500 h-full' : 'h-3/4'}`}></div>
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
            <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>Farmer Growth</h3>
            <Users className={`w-5 h-5 ${darkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
          </div>
          
          <div className="space-y-4 mb-6">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Registered</span>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stats.farmers}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Inputs Received</span>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stats.inputs}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-teal-500 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Active in System</span>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{Math.floor(stats.farmers * 0.9)}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-rose-500 h-2 rounded-full" style={{ width: '90%' }}></div>
              </div>
            </div>
          </div>
          
          <div className={`p-4 rounded-2xl ${darkMode ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
            <p className={`text-xs ${darkMode ? 'text-indigo-300' : 'text-indigo-800'}`}>New registrations are up <strong>15%</strong> compared to last season.</p>
          </div>
        </div>

        {/* Users Analytics */}
        <div className={`p-6 rounded-3xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>System Usage</h3>
            <span className="text-xs font-semibold text-white bg-slate-800 px-2 py-1 rounded-full">Weekly</span>
          </div>

          <div className="flex justify-center items-center py-6 relative">
            {/* Donut Chart Mockup */}
            <div className="w-32 h-32 rounded-full border-[12px] border-slate-100 dark:border-gray-700 relative flex items-center justify-center">
              {/* Fake donut segments using bordered circles */}
              <div className="absolute inset-0 rounded-full border-[12px] border-blue-500" style={{ clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 100%, 0 100%, 0 50%)' }}></div>
              <div className="absolute inset-0 rounded-full border-[12px] border-teal-500" style={{ clipPath: 'polygon(50% 50%, 0 50%, 0 0, 50% 0)' }}></div>
              
              <div className="text-center">
                <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>34</p>
                <p className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Users</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs mt-2">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Clerks</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-teal-500"></span>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Supervisors</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default Dashboard;
