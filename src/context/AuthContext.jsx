'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const AuthContext = createContext(null);

function normaliseUser(user) {
  if (!user) return null;
  return {
    ...user,
    id: Number(user.id),
    membership: user.membership || 'none',
  };
}

async function postAuthRequest(endpoint, body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Your request could not be completed.');
  }
  return normaliseUser(payload.user);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to verify session.');
      const nextUser = normaliseUser(payload.user);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      console.error('Unable to refresh authentication session:', error);
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Remove the legacy mock user. Authentication now comes only from the signed
    // httpOnly cookie and the MySQL users table, never from localStorage.
    try {
      localStorage.removeItem('user');
    } catch {
      // localStorage may be unavailable in a restricted browser context.
    }
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const nextUser = await postAuthRequest('/api/auth/login', { email, password });
    setUser(nextUser);
    setIsLoading(false);
    return nextUser;
  }, []);

  const register = useCallback(async ({ fullName, email, password, phone }) => {
    const nextUser = await postAuthRequest('/api/auth/register', {
      fullName,
      email,
      password,
      phone: phone || '',
    });
    setUser(nextUser);
    setIsLoading(false);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setUser(null);
      setIsLoading(false);
      try {
        localStorage.removeItem('user');
      } catch {
        // Ignore unavailable localStorage.
      }
    }
  }, []);

  const membershipType = user?.membership || 'none';
  const hasMembership = ['basic', 'premium', 'vip'].includes(membershipType);
  const value = useMemo(() => ({
    user,
    isLoggedIn: Boolean(user),
    isLoading,
    hasMembership,
    membershipType,
    login,
    register,
    logout,
    refresh,
  }), [user, isLoading, hasMembership, membershipType, login, register, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
