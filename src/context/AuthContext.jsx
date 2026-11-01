'use client';

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
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsLoggedIn(true);
      }
    } catch {
      localStorage.removeItem('user');
    }
    setIsLoading(false);
  }, []);

  // Login function
  // BATCH 1: still a mock. LoginModal passes a user object while the original
  // signature expected a username string, so accept both (replaced by the real API in Batch 3).
  const login = async (userOrName) => {
    const base = typeof userOrName === 'string'
      ? fetchUser(userOrName)
      : { ...fetchUser(userOrName?.name || 'guest'), ...userOrName };
    // LoginModal sent membership: null, which counted as "has membership"; normalise to 'none'
    const loggedInUser = { ...base, membership: base.membership || 'none' };
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
      {/* Render children immediately so the server can pre-render pages; consumers use isLoading */}
      {children}
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