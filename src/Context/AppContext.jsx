import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [activePS, setActivePS] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [activeModule, setActiveModule] = useState('dashboard');
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

  const logout = () => {
    setCurrentUser(null);
    setActivePS(null);
    setActiveModule('dashboard');
    setDarkMode(false);
    setTestModeState(false);
    window.api.setToken(null);
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
      testMode, setTestMode,
      isLoading, login, register, logout
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
