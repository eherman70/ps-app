import { UploadCloud, MoreVertical, Folder, UserPlus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function RightPanel() {
  const { darkMode } = useAppContext();

  return (
    <aside className={`w-80 border-l p-6 flex flex-col overflow-y-auto ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
      
      {/* Action Block */}
      <div 
        className={`mt-4 mb-8 flex flex-col items-center justify-center py-10 px-6 rounded-3xl border-2 border-dashed cursor-pointer transition-colors ${
          darkMode ? 'border-gray-600 hover:border-blue-500 bg-gray-700/50' : 'border-blue-200 hover:border-brand-blue bg-blue-50/50'
        }`}
      >
        <UploadCloud className={`w-10 h-10 mb-3 ${darkMode ? 'text-blue-400' : 'text-brand-blue'}`} />
        <span className={`font-semibold ${darkMode ? 'text-white' : 'text-brand-navy'}`}>Add New Request</span>
      </div>

      {/* Storage / Quotas */}
      <div className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-brand-navy'}`}>System Quota</h3>
          <span className={`text-sm font-semibold ${darkMode ? 'text-blue-400' : 'text-brand-teal'}`}>25% left</span>
        </div>
        <p className={`text-xs mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>750 of 1000 tickets used</p>
        <div className={`w-full h-2.5 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div className="h-full bg-brand-blue rounded-full" style={{ width: '75%' }}></div>
        </div>
      </div>

      {/* Shared Folders / Quick Contacts */}
      <div>
        <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-brand-navy'}`}>Your shared folders</h3>
        
        <div className="space-y-3">
          <div className={`flex items-center justify-between p-3 rounded-2xl ${darkMode ? 'bg-teal-900/40 text-teal-100' : 'bg-brand-teal/10 text-brand-navy'}`}>
            <div className="flex items-center space-x-3">
              <Folder className={`w-5 h-5 ${darkMode ? 'text-teal-400' : 'text-brand-teal'}`} />
              <span className="font-semibold text-sm">Keynote files</span>
            </div>
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-yellow-400 border border-white"></div>
              <div className="w-6 h-6 rounded-full bg-pink-400 border border-white"></div>
            </div>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-2xl ${darkMode ? 'bg-purple-900/40 text-purple-100' : 'bg-brand-purple/10 text-brand-navy'}`}>
            <div className="flex items-center space-x-3">
              <Folder className={`w-5 h-5 ${darkMode ? 'text-purple-400' : 'text-brand-purple'}`} />
              <span className="font-semibold text-sm">Vacation photos</span>
            </div>
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-blue-400 border border-white"></div>
            </div>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-2xl ${darkMode ? 'bg-pink-900/40 text-pink-100' : 'bg-brand-pink/10 text-brand-navy'}`}>
            <div className="flex items-center space-x-3">
              <Folder className={`w-5 h-5 ${darkMode ? 'text-pink-400' : 'text-brand-pink'}`} />
              <span className="font-semibold text-sm">Project report</span>
            </div>
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-green-400 border border-white"></div>
              <div className="w-6 h-6 rounded-full bg-indigo-400 border border-white"></div>
            </div>
          </div>
        </div>

        <button className={`w-full mt-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
          darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
        }`}>
          + Add more
        </button>
      </div>

    </aside>
  );
}
