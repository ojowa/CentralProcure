'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

const LoadingPlaceholder = () => (
  <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-slate-600 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Checking authentication</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">Please wait...</p>
    </div>
  </div>
);

const UnauthenticatedFallback = ({
  nextPath
}: {
  nextPath: string;
}) => (
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
          onClick={() => window.location.assign(`/vendors/login?next=${encodeURIComponent(nextPath)}`)}
          className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:w-auto"
        >
          Go to Login
        </button>
        <button
          type="button"
          onClick={() => window.location.assign('/vendors/tenders')}
          className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
        >
          Browse Tenders
        </button>
      </div>
    </div>
  </div>
);

const RouteGuard = ({
  children,
  redirect = true
}: {
  children: React.ReactNode;
  redirect?: boolean;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isReady, hasSessionAttempted } = useAuth();
  const nextPath = pathname ?? '/vendors';

  useEffect(() => {
    if (!isReady || !hasSessionAttempted) {
      return;
    }

    if (!redirect || isAuthenticated) {
      return;
    }

    const redirectPath = `${pathname ?? '/vendors'}${window.location.search}`;
    router.replace(`/vendors/login?next=${encodeURIComponent(redirectPath)}`);
  }, [
    isAuthenticated,
    isReady,
    hasSessionAttempted,
    pathname,
    redirect,
    router
  ]);

  if (!isReady || !hasSessionAttempted) {
    return redirect ? <LoadingPlaceholder /> : null;
  }

  if (!isAuthenticated && !redirect) {
    return <UnauthenticatedFallback nextPath={nextPath} />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

export default RouteGuard;
