import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Moon, Sun, FlaskConical, Lock, User, Save, CheckCircle } from 'lucide-react';

function Settings() {
  const { currentUser, darkMode, toggleDarkMode, testMode, setTestMode } = useAppContext();
  const role = (currentUser?.role || '').toLowerCase();
  const isSupervisor = role === 'supervisor' || role === 'admin';

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [psList, setPsList] = useState([]);
  const [deductions, setDeductions] = useState({ default: { levyRate: 2, adminFeeRate: 1 }, byPs: {} });
  const [savingDeductions, setSavingDeductions] = useState(false);

  useEffect(() => {
    const loadDeductionConfig = async () => {
      if (!isSupervisor) return;
      try {
        const [psRows, deductionConfig] = await Promise.all([
          window.api.request('/ps'),
          window.api.request('/deduction-rates')
        ]);
        setPsList(Array.isArray(psRows) ? psRows : []);
        if (deductionConfig && deductionConfig.default) {
          setDeductions(deductionConfig);
        }
      } catch (e) {
        console.error('Failed to load deduction settings:', e);
      }
    };

    loadDeductionConfig();
  }, [isSupervisor]);

  const updateDefaultRate = (field, value) => {
    setDeductions(prev => ({
      ...prev,
      default: {
        ...prev.default,
        [field]: value
      }
    }));
  };

  const updatePsRate = (psCode, field, value) => {
    setDeductions(prev => ({
      ...prev,
      byPs: {
        ...prev.byPs,
        [psCode]: {
          levyRate: prev.byPs?.[psCode]?.levyRate ?? prev.default.levyRate,
          adminFeeRate: prev.byPs?.[psCode]?.adminFeeRate ?? prev.default.adminFeeRate,
          [field]: value
        }
      }
    }));
  };

  const saveDeductionRates = async () => {
    setSavingDeductions(true);
    try {
      const payload = {
        default: {
          levyRate: parseFloat(deductions.default.levyRate) || 0,
          adminFeeRate: parseFloat(deductions.default.adminFeeRate) || 0
        },
        byPs: {}
      };

      for (const ps of psList) {
        const psCode = ps.code;
        const rates = deductions.byPs?.[psCode];
        if (rates) {
          payload.byPs[psCode] = {
            levyRate: parseFloat(rates.levyRate) || 0,
            adminFeeRate: parseFloat(rates.adminFeeRate) || 0
          };
        }
      }

      const savedConfig = await window.api.request('/deduction-rates', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setDeductions(savedConfig);
      alert('Deduction rates saved successfully');
    } catch (e) {
      alert('Failed to save deduction rates: ' + e.message);
    }
    setSavingDeductions(false);
  };

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

      {isSupervisor && (
        <Card title={<>Deduction Rates by PS</>}>
          <div className="space-y-4">
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <p className="font-medium mb-3">Default Rates (used when PS-specific value is not set)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Levy (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={deductions.default.levyRate}
                    onChange={e => updateDefaultRate('levyRate', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-800 border-gray-600' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Admin Fee (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={deductions.default.adminFeeRate}
                    onChange={e => updateDefaultRate('adminFeeRate', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-800 border-gray-600' : 'border-gray-300'}`}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {psList.map(ps => {
                const rates = deductions.byPs?.[ps.code] || {
                  levyRate: deductions.default.levyRate,
                  adminFeeRate: deductions.default.adminFeeRate
                };
                return (
                  <div key={ps.id} className={`grid grid-cols-1 md:grid-cols-3 gap-3 items-center p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="font-medium">{ps.name} ({ps.code})</div>
                    <input
                      type="number"
                      step="0.01"
                      value={rates.levyRate}
                      onChange={e => updatePsRate(ps.code, 'levyRate', e.target.value)}
                      className={`px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-800 border-gray-600' : 'border-gray-300'}`}
                      placeholder="Levy %"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={rates.adminFeeRate}
                      onChange={e => updatePsRate(ps.code, 'adminFeeRate', e.target.value)}
                      className={`px-3 py-2 border rounded-lg ${darkMode ? 'bg-gray-800 border-gray-600' : 'border-gray-300'}`}
                      placeholder="Admin Fee %"
                    />
                  </div>
                );
              })}
            </div>

            <div>
              <button
                onClick={saveDeductionRates}
                disabled={savingDeductions}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {savingDeductions ? 'Saving...' : 'Save Deduction Rates'}
              </button>
            </div>
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
