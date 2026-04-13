import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ── URL ↔ module/tab mapping ──────────────────────────────────────────────────
const ROUTE_MAP = [
  // Top-level
  { path: '/',                          module: 'dashboard',     tab: null },
  { path: '/dashboard',                 module: 'dashboard',     tab: null },
  { path: '/settings',                  module: 'settings',      tab: null },
  // Registration sub-tabs
  { path: '/registration',              module: 'registration',  tab: 'farmers' },
  { path: '/registration/societies',    module: 'registration',  tab: 'societies' },
  { path: '/registration/seasons',      module: 'registration',  tab: 'seasons' },
  { path: '/registration/grades',       module: 'registration',  tab: 'grades' },
  { path: '/registration/markets',      module: 'registration',  tab: 'markets' },
  { path: '/registration/users',        module: 'registration',  tab: 'users' },
  { path: '/registration/farmers',      module: 'registration',  tab: 'farmers' },
  { path: '/farmers',                   module: 'registration',  tab: 'farmers' },
  // Inputs sub-tabs
  { path: '/inputs',                    module: 'inputs',        tab: 'types' },
  { path: '/inputs/types',              module: 'inputs',        tab: 'types' },
  { path: '/inputs/issue',              module: 'inputs',        tab: 'issue' },
  // Tobacco Sales sub-tabs
  { path: '/tobacco-sales',             module: 'tobacco-sales', tab: 'capture' },
  { path: '/tobacco-sales/register',    module: 'tobacco-sales', tab: 'register' },
  { path: '/tobacco-sales/capture',     module: 'tobacco-sales', tab: 'capture' },
  { path: '/tobacco-sales/tickets',     module: 'tobacco-sales', tab: 'tickets' },
  { path: '/tobacco-sales/pcn',         module: 'tobacco-sales', tab: 'pcn' },
  { path: '/tobacco-sales/payments',    module: 'tobacco-sales', tab: 'payments' },
  // Reports sub-tabs
  { path: '/reports',                   module: 'reports',       tab: 'sales' },
  { path: '/reports/sales',             module: 'reports',       tab: 'sales' },
  { path: '/reports/farmers',           module: 'reports',       tab: 'farmers' },
  { path: '/reports/inputs',            module: 'reports',       tab: 'inputs' },
  { path: '/reports/grades',            module: 'reports',       tab: 'grades' },
  { path: '/reports/premium',           module: 'reports',       tab: 'premium' },
  { path: '/reports/payments',          module: 'reports',       tab: 'payments' },
];

function pathFromState(module, tab) {
  const match = ROUTE_MAP.find(r => r.module === module && r.tab === tab);
  if (match && match.path !== '/') return match.path;
  // Fallback: build path manually
  if (!tab) return `/${module}`;
  return `/${module}/${tab}`;
}

function stateFromPath(pathname) {
  const clean = pathname.replace(/\/$/, '') || '/';
  // Exact match first
  const exact = ROUTE_MAP.find(r => r.path === clean);
  if (exact) return { module: exact.module, tab: exact.tab };
  // Prefix match (longest wins)
  const prefix = ROUTE_MAP
    .filter(r => clean.startsWith(r.path) && r.path !== '/')
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (prefix) return { module: prefix.module, tab: prefix.tab };
  return { module: 'dashboard', tab: null };
}

const AppContext = createContext();

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [activePS, setActivePS] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const initialState = stateFromPath(window.location.pathname);
  const [activeModule, setActiveModuleState] = useState(initialState.module);
  const [activeTabOverride, setActiveTabOverride] = useState(initialState.tab);
  const [testMode, setTestModeState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const initializeApp = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        window.api.setToken(token);
        try {
          const response = await window.api.request('/auth/me');
          setCurrentUser(response.user);
          setActivePS(response.user?.ps || null);
          setDarkMode(Boolean(response.user?.darkMode));
          setTestModeState(Boolean(response.user?.testMode));
        } catch (e) {
          console.warn('Stored token invalid, clearing.', e);
          window.api.setToken(null);
          setCurrentUser(null);
          setActivePS(null);
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Init error:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await window.api.login({ username, password });
      setCurrentUser(response.user);
      setActivePS(response.user?.ps || null);
      setDarkMode(Boolean(response.user?.darkMode));
      setTestModeState(Boolean(response.user?.testMode));
      return response.user;
    } catch (error) {
      throw error;
    }
  };

  const register = async (username, password, fullName, ps) => {
    try {
      const response = await window.api.register({ username, password, fullName, ps });
      setCurrentUser(response.user);
      setActivePS(response.user?.ps || null);
      setDarkMode(Boolean(response.user?.darkMode));
      setTestModeState(Boolean(response.user?.testMode));
      return response.user;
    } catch (error) {
      throw error;
    }
  };

  // Sync URL whenever module/tab changes
  useEffect(() => {
    const newPath = pathFromState(activeModule, activeTabOverride);
    if (window.location.pathname !== newPath) {
      window.history.pushState({ module: activeModule, tab: activeTabOverride }, '', newPath);
    }
  }, [activeModule, activeTabOverride]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = (e) => {
      const { module, tab } = e.state || stateFromPath(window.location.pathname);
      setActiveModuleState(module || 'dashboard');
      setActiveTabOverride(tab || null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setActiveModule = useCallback((mod) => {
    setActiveModuleState(mod);
  }, []);

  const logout = () => {
    setCurrentUser(null);
    setActivePS(null);
    setActiveModuleState('dashboard');
    setActiveTabOverride(null);
    setDarkMode(false);
    setTestModeState(false);
    window.api.setToken(null);
    window.history.pushState({}, '', '/');
  };

  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    // Update the user's document root class immediately
    document.documentElement.classList.toggle('dark', newMode);

    if (currentUser) {
      try {
        await window.api.request(`/users/${currentUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({ darkMode: newMode }),
        });
        setCurrentUser(prev => ({ ...prev, darkMode: newMode }));
      } catch (error) {
        console.error('Error updating dark mode:', error);
      }
    }
  };

  const setTestMode = async (value) => {
    setTestModeState(value);
    if (currentUser) {
      try {
        await window.api.request(`/users/${currentUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({ testMode: value }),
        });
        setCurrentUser(prev => ({ ...prev, testMode: value }));
      } catch (error) {
        console.error('Error updating test mode:', error);
      }
    }
  };

  const updateCurrentUser = (updates) => {
    setCurrentUser(prev => ({ ...prev, ...updates }));
  };

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, updateCurrentUser,
      activePS, setActivePS,
      darkMode, toggleDarkMode,
      activeModule, setActiveModule,
      activeTabOverride, setActiveTabOverride,
      testMode, setTestMode,
      isLoading, login, register, logout
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
