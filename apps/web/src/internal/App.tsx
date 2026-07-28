'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InternalShellLayout } from './components/InternalShellLayout';
import { useAuth } from './hooks/useAuth';

const App = () => {
  const { isAuthenticated, isReady, hasSessionAttempted, user, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!hasSessionAttempted) return;
    if (!isAuthenticated) {
      router.replace('/internal/login');
    }
  }, [isAuthenticated, isReady, hasSessionAttempted, router]);

  if (!isReady || (!isAuthenticated && !hasSessionAttempted)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Checking authentication...
        </div>
      </div>
    );
  }

  if (!isAuthenticated && hasSessionAttempted) {
    return null;
  }

  return (
    <InternalShellLayout 
      token={token} 
      userRole={user?.role} 
      userEmail={user?.email}
    />
  );
};

export default App;
