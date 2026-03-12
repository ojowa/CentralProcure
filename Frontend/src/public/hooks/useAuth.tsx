'use client';

import { createContext, useContext, useEffect, useRef, useState, type FC, type ReactNode } from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    isReady: boolean;
    login: () => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const WARNING_THRESHOLD_MS = 60 * 1000;
const LAST_ACTIVE_KEY = 'vendorLastActiveAt';

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isReady, setIsReady] = useState<boolean>(false);
    const [warningRemainingMs, setWarningRemainingMs] = useState<number | null>(null);
    const idleTimerRef = useRef<number | null>(null);
    const warningTimerRef = useRef<number | null>(null);
    const lastActiveRef = useRef<number | null>(null);
    const keepAliveRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const syncAuth = () => {
            const hasToken = Boolean(localStorage.getItem('vendorAuthToken'));
            setIsAuthenticated(hasToken);
            setIsReady(true);
        };

        syncAuth();

        const handleStorage = (event: StorageEvent) => {
            if (event.key === 'vendorAuthToken') {
                syncAuth();
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const login = () => {
        setIsAuthenticated(true);
    };

    const logout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem('vendorAuthToken');
        localStorage.removeItem('vendorId');
        localStorage.removeItem('vendorCompanyName');
        localStorage.removeItem('vendorEmail');
        localStorage.removeItem(LAST_ACTIVE_KEY);
    };

    useEffect(() => {
        if (!isReady || !isAuthenticated) {
            if (idleTimerRef.current) {
                window.clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
            if (warningTimerRef.current) {
                window.clearInterval(warningTimerRef.current);
                warningTimerRef.current = null;
            }
            setWarningRemainingMs(null);
            return;
        }

        const scheduleTimeout = () => {
            if (idleTimerRef.current) {
                window.clearTimeout(idleTimerRef.current);
            }

            const lastActive = lastActiveRef.current ?? Date.now();
            const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActive);
            if (remaining <= 0) {
                logout();
                return;
            }

            idleTimerRef.current = window.setTimeout(() => {
                const now = Date.now();
                const last = lastActiveRef.current ?? now;
                if (now - last >= IDLE_TIMEOUT_MS) {
                    logout();
                } else {
                    scheduleTimeout();
                }
            }, remaining);
        };

        const recordActivity = () => {
            const now = Date.now();
            lastActiveRef.current = now;
            localStorage.setItem(LAST_ACTIVE_KEY, String(now));
            setWarningRemainingMs(null);
            scheduleTimeout();
        };
        keepAliveRef.current = recordActivity;

        const hydrateLastActive = () => {
            const stored = localStorage.getItem(LAST_ACTIVE_KEY);
            const parsed = stored ? Number(stored) : NaN;
            const now = Date.now();
            lastActiveRef.current = Number.isFinite(parsed) ? parsed : now;
            if (!stored) {
                localStorage.setItem(LAST_ACTIVE_KEY, String(now));
            }
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === LAST_ACTIVE_KEY && event.newValue) {
                const parsed = Number(event.newValue);
                if (Number.isFinite(parsed)) {
                    lastActiveRef.current = parsed;
                    scheduleTimeout();
                }
            }
        };

        hydrateLastActive();
        scheduleTimeout();

        const updateWarning = () => {
            const now = Date.now();
            const last = lastActiveRef.current ?? now;
            const remaining = IDLE_TIMEOUT_MS - (now - last);
            if (remaining <= 0) {
                setWarningRemainingMs(0);
                return;
            }
            if (remaining <= WARNING_THRESHOLD_MS) {
                setWarningRemainingMs(remaining);
            } else {
                setWarningRemainingMs(null);
            }
        };

        updateWarning();
        warningTimerRef.current = window.setInterval(updateWarning, 1000);

        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;
        activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
        window.addEventListener('storage', handleStorage);

        return () => {
            if (idleTimerRef.current) {
                window.clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
            if (warningTimerRef.current) {
                window.clearInterval(warningTimerRef.current);
                warningTimerRef.current = null;
            }
            activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
            window.removeEventListener('storage', handleStorage);
        };
    }, [isAuthenticated, isReady]);

    const handleStaySignedIn = () => {
        keepAliveRef.current?.();
    };

    const warningSeconds = warningRemainingMs ? Math.max(1, Math.ceil(warningRemainingMs / 1000)) : null;

    return (
        <AuthContext.Provider value={{ isAuthenticated, isReady, login, logout }}>
            {children}
            {isReady && isAuthenticated && warningSeconds !== null && (
                <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl">
                    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-lg sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold">You will be logged out soon due to inactivity.</p>
                            <p className="text-xs text-amber-800">
                                Session expires in {warningSeconds} second{warningSeconds === 1 ? '' : 's'}.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleStaySignedIn}
                            className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
                        >
                            Stay signed in
                        </button>
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
