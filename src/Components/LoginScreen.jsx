import { useState } from 'react';
import { Leaf, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

function LoginScreen() {
  const { darkMode, login, register } = useAppContext();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [ps, setPs] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (isRegistering) {
        if (!username || !password || !fullName || !ps) {
          throw new Error('Please fill all required fields');
        }
        await register(username, password, fullName, ps);
      } else {
        await login(username, password);
      }
    } catch (error) {
      setError(error.message || (isRegistering ? 'Registration failed' : 'Login failed'));
    }
    setLoading(false);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-green-50 to-blue-50'}`}>
      <div className={`max-w-md w-full mx-4 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl p-8`}>
        <div className="text-center mb-8">
          <Leaf className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Tobacco Management</h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>Farmer Payment System</p>
        </div>

        <div className="space-y-4">
          {isRegistering && (
            <div>
              <label className={`block mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
            </div>
          )}

          <div>
            <label className={`block mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Username *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && document.getElementById('pwd').focus()}
              className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>

          <div>
            <label className={`block mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Password *</label>
            <input
              id="pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => !isRegistering && e.key === 'Enter' && handleSubmit()}
              className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>

          {isRegistering && (
            <div>
              <label className={`block mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Society / Grower Group (Code) *</label>
              <input
                type="text"
                value={ps}
                onChange={(e) => setPs(e.target.value)}
                placeholder="Enter your Society code"
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                className={`w-full px-4 py-2 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !username || !password || (isRegistering && (!fullName || !ps))}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50"
          >
            {loading ? (isRegistering ? 'Registering...' : 'Logging in...') : (isRegistering ? 'Create Account' : 'Login')}
          </button>
        </div>
        
        <div className="mt-4 text-center">
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className={`text-sm font-medium hover:underline ${darkMode ? 'text-green-400' : 'text-green-600'}`}
          >
            {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        {!isRegistering && (
          <div className={`mt-6 p-4 ${darkMode ? 'bg-gray-700' : 'bg-blue-50'} rounded-lg`}>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <strong>Demo:</strong> admin / admin123
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginScreen;
