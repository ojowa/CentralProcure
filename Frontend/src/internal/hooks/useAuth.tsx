'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RoleKey } from '../types/internal';
import {
  COOKIE_SESSION_TOKEN,
  fetchInternalUserProfile,
  logoutInternalUser,
  resolveRole
} from '../services/internalAuthService';

type AuthUser = {
  email: string;
  role: RoleKey;
};

type AuthContextType = {
  isAuthenticated: boolean;
  isReady: boolean;
  token: string;
  user: AuthUser | null;
  login: (payload: { email: string; role: RoleKey }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const profile = await fetchInternalUserProfile();
        if (!isMounted) {
          return;
        }

        const role = resolveRole(profile.RoleName);
        if (!role) {
          throw new Error('Internal user role is not configured.');
        }

        setToken(COOKIE_SESSION_TOKEN);
        setUser({
          email: profile.Email,
          role
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setToken('');
        setUser(null);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = ({ email, role }: { email: string; role: RoleKey }) => {
    setToken(COOKIE_SESSION_TOKEN);
    setUser({ email, role });
    setIsReady(true);
  };

  const logout = () => {
    setToken('');
    setUser(null);
    void logoutInternalUser().catch(() => undefined);
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
