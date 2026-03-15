import axios from 'axios';
import { APP_BASE_PATH } from '../../utils/basePath';

const CSRF_COOKIE = 'XSRF-TOKEN';

const getCookieValue = (name: string): string | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[2]) : null;
};

// Create an Axios instance
const apiClient = axios.create({
    // Using relative URL to leverage Next.js rewrites defined in next.config.mjs
    baseURL: APP_BASE_PATH || '/',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Optional: Add request interceptors for things like auth tokens
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

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Optional: Add response interceptors for error handling, token refresh, etc.
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Handle global errors, e.g., redirect to login on 401
        if (error.response && error.response.status === 401) {
            // Redirect to login page or refresh token
            console.warn('Unauthorized request, potentially redirect to login.');
        }
        return Promise.reject(error);
    }
);

export default apiClient;
