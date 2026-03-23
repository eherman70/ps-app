import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [testMode, setTestMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const initializeApp = async () => {
    try {
      // Initialize default admin user
      await window.storage.set('user_admin', JSON.stringify({
        username: 'admin',
        password: 'admin123',
        role: 'supervisor',
        ps: 'All',
        fullName: 'System Administrator',
        createdAt: new Date().toISOString()
      }));

      // Initialize farmer counter
      try {
        const farmerCounter = await window.storage.get('counter_farmer');
        if (!farmerCounter) await window.storage.set('counter_farmer', '1000');
      } catch (e) {
        await window.storage.set('counter_farmer', '1000');
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

  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);

    if (currentUser) {
      const updatedUser = { ...currentUser, darkMode: newMode };
      await window.storage.set(`user_${currentUser.username}`, JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveModule('dashboard');
  };

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser,
      darkMode, toggleDarkMode,
      activeModule, setActiveModule,
      testMode, setTestMode,
      isLoading, handleLogout
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
