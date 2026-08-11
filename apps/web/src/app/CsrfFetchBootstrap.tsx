'use client';

import { useEffect } from 'react';
import { COOKIE_SESSION_TOKEN } from '../internal/services/internalAuthService';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-CSRF-Token';
const PATCH_FLAG = '__eprocurementCsrfFetchPatched';
const SENTINEL_AUTH_HEADER = `Bearer ${COOKIE_SESSION_TOKEN}`;

const getCookieValue = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
};

const isSafeMethod = (method?: string | null): boolean => {
  const normalized = (method ?? 'GET').toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS';
};

const isSameOriginRequest = (input: RequestInfo | URL): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const requestUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (!requestUrl) {
    return true;
  }

  if (requestUrl.startsWith('/')) {
    return true;
  }

  try {
    return new URL(requestUrl, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
};

export const CsrfFetchBootstrap = () => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const globalWindow = window as Window & {
      [PATCH_FLAG]?: boolean;
      __eprocurementOriginalFetch__?: typeof window.fetch;
    };

    if (globalWindow[PATCH_FLAG]) {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    globalWindow.__eprocurementOriginalFetch__ = originalFetch;
    globalWindow[PATCH_FLAG] = true;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method =
        init?.method ??
        (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET');

      if (!isSameOriginRequest(input)) {
        return originalFetch(input, init);
      }

      const headers = new Headers(
        init?.headers ??
        (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
      );

      if (headers.get('Authorization') === SENTINEL_AUTH_HEADER) {
        headers.delete('Authorization');
      }

      if (!isSafeMethod(method) && !headers.has(CSRF_HEADER)) {
        const csrfToken = getCookieValue(CSRF_COOKIE);
        if (csrfToken) {
          headers.set(CSRF_HEADER, csrfToken);
        }
      }

      if (typeof Request !== 'undefined' && input instanceof Request) {
        return originalFetch(
          new Request(input, {
            ...init,
            headers,
            credentials: init?.credentials ?? input.credentials
          })
        );
      }

      return originalFetch(input, {
        ...init,
        headers,
        credentials: init?.credentials ?? 'same-origin'
      });
    };
  }, []);

  return null;
};
