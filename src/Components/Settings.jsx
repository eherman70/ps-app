import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Moon, Sun, FlaskConical, Lock, User, Save, CheckCircle } from 'lucide-react';

function Settings() {
  const { currentUser, darkMode, toggleDarkMode, testMode, setTestMode } = useAppContext();
  const isSupervisor = currentUser.role === 'supervisor' || currentUser.role === 'admin';

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const changePassword = async () => {
    if (!pwForm.newPw || pwForm.newPw !== pwForm.confirm) {
      alert('New passwords do not match');
      return;
    }
    if (pwForm.newPw.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await window.api.request(`/users/${currentUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ password: pwForm.newPw }),
      });
      setSaved(true);
      setPwForm({ current: '', newPw: '', confirm: '' });
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Failed to change password: ' + e.message);
    }
    setSaving(false);
  };

  const Card = ({ children, title }) => (
    <div className={`rounded-2xl shadow p-6 mb-6 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
      <h4 className="font-semibold text-lg mb-5 flex items-center gap-2">{title}</h4>
      {children}
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      {/* Profile Info */}
      <Card title={<><User className="w-5 h-5 text-blue-500" /> Profile</>}>
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} space-y-2`}>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Full Name</span>
            <span className="font-medium">{currentUser.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Username</span>
            <span className="font-medium">{currentUser.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Role</span>
            <span className="font-medium">{currentUser.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Assigned PS</span>
            <span className="font-medium">{currentUser.ps === 'All' ? 'All Societies' : currentUser.ps}</span>
          </div>
        </div>
      </Card>

      {/* Theme */}
      <Card title={<><>{darkMode ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-yellow-500" />}</> Display Theme</>}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{darkMode ? 'Dark Mode' : 'Light Mode'}</p>
            <p className="text-sm text-gray-500">Applies across the entire system</p>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${darkMode ? 'translate-x-8' : 'translate-x-1'}`} />
          </button>
        </div>
      </Card>

      {/* Test Mode — Supervisor only */}
      {isSupervisor && (
        <Card title={<><FlaskConical className="w-5 h-5 text-yellow-500" /> Test / Sandbox Mode</>}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{testMode ? 'Test Mode ACTIVE' : 'Test Mode Disabled'}</p>
              <p className="text-sm text-gray-500">Simulate farmer registration, ticket capture, and payments without affecting live data.</p>
              {testMode && (
                <p className="text-xs text-yellow-600 font-semibold mt-1">⚠ Any data entered in test mode will be marked as test data</p>
              )}
            </div>
            <button
              onClick={() => setTestMode(!testMode)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${testMode ? 'bg-yellow-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${testMode ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
          </div>
        </Card>
      )}

      {/* Change Password */}
      <Card title={<><Lock className="w-5 h-5 text-green-500" /> Change Password</>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">New Password</label>
            <input
              type="password"
              value={pwForm.newPw}
              onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Confirm New Password</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
              placeholder="Re-enter new password"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={changePassword}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Change Password'}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <CheckCircle className="w-4 h-4" /> Password changed!
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Settings;
