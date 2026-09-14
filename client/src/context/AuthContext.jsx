import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('smartscan_token') || null);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('smartscan_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Synchronize authentication state from server on startup
  const fetchCurrentUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      if (response?.data?.user) {
        setUser(response.data.user);
        localStorage.setItem('smartscan_user', JSON.stringify(response.data.user));
      }
    } catch (err) {
      console.warn('[Auth] Session validation failed:', err.message);
      // Clean stale credentials
      setToken(null);
      setUser(null);
      localStorage.removeItem('smartscan_token');
      localStorage.removeItem('smartscan_user');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCurrentUser();

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('smartscan-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('smartscan-unauthorized', handleUnauthorized);
  }, [fetchCurrentUser]);

  // Customer or Staff Login
  const login = async (identifier, password) => {
    const response = await api.post('/auth/login', { identifier, password });
    const { token: newToken, user: newUser } = response.data;
    const uid = newUser?._id || newUser?.id;

    console.log(`[AUTH] Logged in user: ${newUser?.name || 'User'} (${uid})`);
    console.log(`[AUTH] Current user ID: ${uid}`);

    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('smartscan_token', newToken);
    localStorage.setItem('smartscan_user', JSON.stringify(newUser));

    return newUser;
  };

  // Customer Registration
  const register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    const { token: newToken, user: newUser } = response.data;
    const uid = newUser?._id || newUser?.id;

    console.log(`[AUTH] Logged in user: ${newUser?.name || 'User'} (${uid})`);
    console.log(`[AUTH] Current user ID: ${uid}`);

    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('smartscan_token', newToken);
    localStorage.setItem('smartscan_user', JSON.stringify(newUser));

    return newUser;
  };

  // Logout
  const logout = () => {
    const uid = user?._id || user?.id;
    console.log(`[AUTH] Logging out user: ${uid || 'unknown'}`);

    setToken(null);
    setUser(null);
    localStorage.removeItem('smartscan_token');
    localStorage.removeItem('smartscan_user');

    // Notify listeners (e.g. CartContext) to purge in-memory and cached states
    window.dispatchEvent(new CustomEvent('smartscan-logout', { detail: { userId: uid } }));
  };

  // Update Profile (Name, Phone, Email, Role)
  const updateProfile = async (updateData) => {
    const response = await api.put('/auth/profile', updateData);
    const updatedUser = response.data?.user || response.data;
    const newToken = response.data?.token;

    if (updatedUser) {
      setUser(updatedUser);
      localStorage.setItem('smartscan_user', JSON.stringify(updatedUser));
    }

    if (newToken) {
      setToken(newToken);
      localStorage.setItem('smartscan_token', newToken);
    }

    return updatedUser;
  };

  const normRole = (user?.role || '').toUpperCase();
  const isAdmin = normRole === 'SUPER_ADMIN' || normRole === 'ADMIN' || normRole === 'BRANCH_MANAGER' || normRole === 'MANAGER';
  const isStaff = isAdmin || normRole === 'BRANCH_STAFF' || normRole === 'STAFF';
  const isCustomer = !isStaff;

  const value = {
    token,
    user,
    role: normRole || 'CUSTOMER',
    rawRole: user?.role || 'CUSTOMER',
    isAuthenticated: !!token && !!user,
    isStaff,
    isAdmin,
    isCustomer,
    loading,
    login,
    register,
    logout,
    updateProfile,
    refreshProfile: fetchCurrentUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
