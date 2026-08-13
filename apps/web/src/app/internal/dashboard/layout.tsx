'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../internal/hooks/useAuth';
import { InternalWorkspaceProvider, useWorkspace } from '../../../internal/components/shell/InternalWorkspaceContext';
import { InternalHeader } from '../../../internal/components/shell/InternalHeader';
import { SidebarNav } from '../../../internal/components/shell/SidebarNav';

const WorkspaceShell = ({ children }: { children: React.ReactNode }) => {
  const {
    modules,
    modulesLoading,
    modulesError,
    activeModuleId,
    handleModuleChange,
    handleSignOut,
    token,
    headerRoleDefinition
  } = useWorkspace();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="portal-shell">
      <InternalHeader role={headerRoleDefinition} token={token} onSignOut={handleSignOut} onToggleSidebar={toggleSidebar} />
      <div className="portal-flagband" aria-hidden="true" />
      <div className="portal-content">
        {sidebarOpen && <div className="portal-sidebar-overlay" onClick={closeSidebar} />}
        <SidebarNav
          modules={modules}
          activeModuleId={activeModuleId ?? 'dashboard'}
          onModuleChange={(id) => {
            handleModuleChange(id);
            closeSidebar();
          }}
          className={sidebarOpen ? 'is-open' : undefined}
        />
        <main className="portal-main">
          {modulesError ? <div className="portal-alert">{modulesError}</div> : null}
          {modulesLoading ? <div className="plan-loading">Loading role workspace...</div> : null}
          {children}
        </main>
      </div>
    </div>
  );
};

export default function InternalDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady, hasSessionAttempted } = useAuth();
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
    <InternalWorkspaceProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </InternalWorkspaceProvider>
  );
}