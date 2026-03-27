'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

const DashboardGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isReady, hasSessionAttempted } = useAuth();
  const nextPath =
    (pathname ?? '/vendors/dashboard') +
    (searchParams && searchParams.toString() ? `?${searchParams.toString()}` : '');

  useEffect(() => {
    if (!isReady) return;
    if (!hasSessionAttempted) return;
    if (!isAuthenticated) {
      router.replace(`/vendors/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [hasSessionAttempted, isAuthenticated, isReady, nextPath, router]);

  if (!isReady || (!isAuthenticated && !hasSessionAttempted)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Checking authentication...
        </div>
      </div>
    );
  }

  if (!isAuthenticated && hasSessionAttempted) {
    return null;
  }

  return <>{children}</>;
};

export default DashboardGuard;
