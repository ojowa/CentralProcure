'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RoleKey } from '../types/internal';

type AuthUser = {
  email: string;
  role: RoleKey;
};

type AuthContextType = {
  isAuthenticated: boolean;
  isReady: boolean;
  token: string;
  user: AuthUser | null;
  login: (payload: { token: string; email: string; role: RoleKey }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  token: 'internalAuthToken',
  email: 'internalAuthEmail',
  role: 'internalAuthRole'
};

const normalizeStoredRole = (role: string | null): RoleKey | null => {
  if (!role) {
    return null;
  }

  if (role === 'department_user') {
    return 'requisitioning_officer';
  }

  return role as RoleKey;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return localStorage.getItem(STORAGE_KEYS.token) ?? '';
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const storedToken = localStorage.getItem(STORAGE_KEYS.token);
    const storedEmail = localStorage.getItem(STORAGE_KEYS.email);
    const storedRole = normalizeStoredRole(localStorage.getItem(STORAGE_KEYS.role));

    if (storedToken && storedEmail && storedRole) {
      return { email: storedEmail, role: storedRole };
    }
    return null;
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.token);
    const storedEmail = localStorage.getItem(STORAGE_KEYS.email);
    const storedRole = normalizeStoredRole(localStorage.getItem(STORAGE_KEYS.role));

    if (storedToken && storedEmail && storedRole) {
      setToken(storedToken);
      setUser({ email: storedEmail, role: storedRole });
      localStorage.setItem(STORAGE_KEYS.role, storedRole);
    } else {
      setToken('');
      setUser(null);
    }
    setIsReady(true);
  }, []);

  const login = ({ token: nextToken, email, role }: { token: string; email: string; role: RoleKey }) => {
    setToken(nextToken);
    setUser({ email, role });
    localStorage.setItem(STORAGE_KEYS.token, nextToken);
    localStorage.setItem(STORAGE_KEYS.email, email);
    localStorage.setItem(STORAGE_KEYS.role, role);
  };

  const logout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.email);
    localStorage.removeItem(STORAGE_KEYS.role);
  };

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token && user),
      isReady,
      token,
      user,
      login,
      logout
    }),
    [token, user, isReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
