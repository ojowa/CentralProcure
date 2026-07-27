import axios from 'axios';
import { APP_BASE_PATH } from '../../../utils/basePath';

const CSRF_COOKIE = 'XSRF-TOKEN';
const VENDOR_AUTH_TOKEN_KEY = 'vendorAuthToken';

const getCookieValue = (name: string): string | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[2]) : null;
};

const getStoredVendorAuthToken = (): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    return localStorage.getItem(VENDOR_AUTH_TOKEN_KEY);
};

const apiClient = axios.create({
    // Use relative /api routes and rely on Next.js rewrites to reach services.
    baseURL: APP_BASE_PATH || '/',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add request interceptor to always include auth token
apiClient.interceptors.request.use(
    (config) => {
        // Always attach auth token if available
        const token = getStoredVendorAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        const method = (config.method ?? 'get').toLowerCase();
        const isUnsafeMethod = !['get', 'head', 'options'].includes(method);

        if (isUnsafeMethod) {
            const csrfToken = getCookieValue(CSRF_COOKIE);
            if (csrfToken) {
                config.headers['X-CSRF-Token'] = csrfToken;
            }
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const fetchCsrfToken = async (): Promise<void> => {
    try {
        await apiClient.get('/api/Auth/csrf');
    } catch (error) {
        console.warn('[Auth] CSRF init failed (ignoring for resilience):', error);
    }
};

export default apiClient;
