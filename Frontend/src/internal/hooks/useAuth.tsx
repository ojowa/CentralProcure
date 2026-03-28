'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RoleKey } from '../types/internal';
import {
  COOKIE_SESSION_TOKEN,
  fetchCsrfToken,
  fetchInternalUserProfile,
  logoutInternalUser,
  resolveCanonicalRole
} from '../services/internalAuthService';

type AuthUser = {
  email: string;
  role: RoleKey;
};

type AuthContextType = {
  isAuthenticated: boolean;
  isReady: boolean;
  hasSessionAttempted: boolean;
  token: string;
  user: AuthUser | null;
  login: (payload: { email: string; role: RoleKey }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INTERNAL_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const INTERNAL_LAST_ACTIVITY_KEY = '__internal_last_activity__';
const INTERNAL_LOGOUT_BROADCAST_KEY = '__internal_logout_broadcast__';
const ACTIVITY_SYNC_EVENTS: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'focus'];

const readTimestamp = (key: string): number | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasSessionAttempted, setHasSessionAttempted] = useState(false);
  const idleTimeoutRef = useRef<number | null>(null);
  const logoutInFlightRef = useRef(false);
  const lastActivityWriteRef = useRef(0);

  const clearIdleTimeout = useCallback(() => {
    if (idleTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  const performLogout = useCallback((broadcast: boolean) => {
    if (logoutInFlightRef.current) {
      return;
    }

    logoutInFlightRef.current = true;
    clearIdleTimeout();
    setToken('');
    setUser(null);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(INTERNAL_LAST_ACTIVITY_KEY);
      if (broadcast) {
        window.localStorage.setItem(INTERNAL_LOGOUT_BROADCAST_KEY, Date.now().toString());
      }
    }

    void logoutInternalUser()
      .catch(() => undefined)
      .finally(() => {
        logoutInFlightRef.current = false;
      });
  }, [clearIdleTimeout]);

  const scheduleIdleTimeout = useCallback((activityAt?: number) => {
    if (typeof window === 'undefined') {
      return;
    }

    clearIdleTimeout();

    const lastActivityAt = activityAt ?? readTimestamp(INTERNAL_LAST_ACTIVITY_KEY) ?? Date.now();
    const remainingTime = INTERNAL_IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt);

    if (remainingTime <= 0) {
      performLogout(true);
      return;
    }

    idleTimeoutRef.current = window.setTimeout(() => {
      performLogout(true);
    }, remainingTime);
  }, [clearIdleTimeout, performLogout]);

  const markActivity = useCallback((force = false) => {
    if (typeof window === 'undefined') {
      return;
    }

    const now = Date.now();
    if (force || now - lastActivityWriteRef.current >= 1000) {
      lastActivityWriteRef.current = now;
      window.localStorage.setItem(INTERNAL_LAST_ACTIVITY_KEY, now.toString());
    }

    scheduleIdleTimeout(now);
  }, [scheduleIdleTimeout]);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      let sessionExpiredByInactivity = false;
      let shouldClearSession = false;

      try {
        // First ensure we have a CSRF token for any state-changing requests later
        await fetchCsrfToken();
        
        console.log('[Internal Auth] Fetching user profile...');
        const profile = await fetchInternalUserProfile();
        console.log('[Internal Auth] Profile fetched:', profile);
        if (!isMounted) {
          return;
        }

        const role = resolveCanonicalRole(profile.CanonicalRoleKey, profile.RoleName);
        console.log('[Internal Auth] Resolved role:', role);
        if (!role) {
          throw new Error('Internal user role is not configured.');
        }

        const lastActivityAt = readTimestamp(INTERNAL_LAST_ACTIVITY_KEY);
        if (lastActivityAt && Date.now() - lastActivityAt >= INTERNAL_IDLE_TIMEOUT_MS) {
          sessionExpiredByInactivity = true;
          throw new Error('Internal session expired.');
        }

        setToken(COOKIE_SESSION_TOKEN);
        setUser({
          email: profile.Email,
          role
        });
        markActivity(true);
        console.log('[Internal Auth] Session restored successfully');
      } catch (error) {
        console.error('[Internal Auth] Failed to restore session:', error);
        if (!isMounted) {
          return;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        const isAuthError = errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Unauthorized');

        if (sessionExpiredByInactivity || isAuthError) {
          shouldClearSession = true;
        }

        if (sessionExpiredByInactivity) {
          void logoutInternalUser().catch(() => undefined);
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(INTERNAL_LAST_ACTIVITY_KEY);
          }
        }

        if (shouldClearSession) {
          setToken('');
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setHasSessionAttempted(true);
          setIsReady(true);
          console.log('[Internal Auth] Session attempt complete');
        }
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, [markActivity]);

  useEffect(() => {
    if (typeof window === 'undefined' || !token || !user) {
      clearIdleTimeout();
      return;
    }

    markActivity(true);

    const handleActivity = () => {
      markActivity();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        markActivity();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === INTERNAL_LAST_ACTIVITY_KEY && event.newValue) {
        const syncedActivityAt = Number(event.newValue);
        if (Number.isFinite(syncedActivityAt)) {
          scheduleIdleTimeout(syncedActivityAt);
        }
      }

      if (event.key === INTERNAL_LOGOUT_BROADCAST_KEY && event.newValue) {
        performLogout(false);
      }
    };

    for (const eventName of ACTIVITY_SYNC_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      clearIdleTimeout();
      for (const eventName of ACTIVITY_SYNC_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [clearIdleTimeout, markActivity, performLogout, scheduleIdleTimeout, token, user]);

  const login = ({ email, role }: { email: string; role: RoleKey }) => {
    setToken(COOKIE_SESSION_TOKEN);
    setUser({ email, role });
    setIsReady(true);
    markActivity(true);
  };

  const logout = () => {
    performLogout(true);
  };

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token && user),
      isReady,
      hasSessionAttempted,
      token,
      user,
      login,
      logout
    }),
    [token, user, isReady, hasSessionAttempted]
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
