import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [activePS, setActivePS] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [testMode, setTestMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const initializeApp = async () => {
    try {
      // Check for stored token and validate with server
      const token = localStorage.getItem('token');
      if (token) {
        window.api.setToken(token);
        try {
          const response = await window.api.request('/auth/me');
          setCurrentUser(response.user);
          setActivePS(response.user?.ps || null);
          if (response.user?.darkMode) {
            setDarkMode(true);
          }
        } catch (e) {
          // Token invalid or expired - clear it
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
      if (response.user?.darkMode) {
        setDarkMode(true);
      }
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
      if (response.user?.darkMode) {
        setDarkMode(true);
      }
      return response.user;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setActivePS(null);
    setActiveModule('dashboard');
    window.api.setToken(null);
  };

  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);

    if (currentUser) {
      // Update user preferences in backend
      try {
        // This would be implemented when we add user preferences API
        // await window.api.update('users', currentUser.id, { darkMode: newMode });
      } catch (error) {
        console.error('Error updating dark mode:', error);
      }
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser,
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
