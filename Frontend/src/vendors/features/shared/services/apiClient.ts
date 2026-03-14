import axios from 'axios';
import { APP_BASE_PATH } from '../../../utils/basePath';

const CSRF_COOKIE = 'XSRF-TOKEN';

const getCookieValue = (name: string): string | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[2]) : null;
};

const apiClient = axios.create({
    // Use relative /api routes and rely on Next.js rewrites to reach services.
    baseURL: APP_BASE_PATH || '/',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Optional: Add an interceptor to include auth tokens
apiClient.interceptors.request.use(
    (config) => {
        const method = (config.method ?? 'get').toLowerCase();
        const isUnsafeMethod = !['get', 'head', 'options'].includes(method);

        if (isUnsafeMethod) {
            const csrfToken = getCookieValue(CSRF_COOKIE);
            if (csrfToken) {
                config.headers['X-CSRF-Token'] = csrfToken;
            }
        }

        const token = localStorage.getItem('vendorAuthToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default apiClient;
