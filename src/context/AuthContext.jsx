// src/context/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';

// 1. Create the Context
const AuthContext = createContext();

// Function to simulate fetching user details after login, now includes a membership field
const fetchUser = (username) => ({
  id: 1,
  name: username,
  email: `${username.toLowerCase()}@example.com`,
  role: 'member',
  // Default membership status
  membership: 'none', // 'none', 'basic', 'premium', 'vip'
});

// 2. Create the Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Derived State for easy access in components
  const hasMembership = user && user.membership !== 'none';
  const membershipType = user ? user.membership : 'none';

  // Load state from local storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setIsLoggedIn(true);
    }
    setIsLoading(false);
  }, []);

  // Login function
  const login = async (username, password) => {
    // Simulate successful login after API call
    const loggedInUser = fetchUser(username); 
    setUser(loggedInUser);
    setIsLoggedIn(true);
    localStorage.setItem('user', JSON.stringify(loggedInUser));

    return true; // Indicate success
  };

  // Logout function
  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('user');
  };

  // NEW: Function to update membership status
  const updateMembership = (planId) => {
    if (user) {
        // Create new user object with updated membership
        const updatedUser = { ...user, membership: planId };
        setUser(updatedUser);
        // Persist the updated user data
        localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const contextValue = {
    user,
    isLoggedIn,
    isLoading,
    hasMembership,      // <- NOW EXPOSED for Checkout.jsx
    membershipType,     // <- NOW EXPOSED for Checkout.jsx
    login,
    logout,
    updateMembership,   // <- NOW EXPOSED for Membership.jsx
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

// 3. Create the Custom Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};