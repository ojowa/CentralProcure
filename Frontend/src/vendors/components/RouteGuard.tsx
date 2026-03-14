'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

const RouteGuard = ({
  children,
  redirect = true
}: {
  children: React.ReactNode;
  redirect?: boolean;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (isAuthenticated) return;
    if (!redirect) return;

    const search = searchParams?.toString();
    const nextPath = search ? `${pathname}?${search}` : pathname;
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [isAuthenticated, isReady, pathname, router, searchParams]);

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
    if (redirect) {
      return null;
    }

    const search = searchParams?.toString();
    const nextPath = search ? `${pathname}?${search}` : pathname;
    return (
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-700 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Authentication Required</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Please log in to continue</h2>
          <p className="mt-2 text-sm text-slate-500">
            You need to sign in before you can access this page.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
              className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:w-auto"
            >
              Go to Login
            </button>
            <button
              type="button"
              onClick={() => router.push('/tenders')}
              className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Browse Tenders
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RouteGuard;
