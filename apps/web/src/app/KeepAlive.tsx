'use client';

import { useEffect } from 'react';

export function KeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch('/api/health').catch(() => {});
    };

    ping();
    const interval = setInterval(ping, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
