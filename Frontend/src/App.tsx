'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InternalShellLayout } from './components/InternalShell';
import { useAuth } from './hooks/useAuth';

const App = () => {
  const { isAuthenticated, isReady, user, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace('/internal/login');
    }
  }, [isAuthenticated, isReady, router]);

  if (!isReady || !isAuthenticated) {
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

