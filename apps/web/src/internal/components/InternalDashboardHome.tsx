'use client';

import { useWorkspace } from './InternalWorkspaceContext';
import { DashboardPage } from './DashboardPage';

export const InternalDashboardHome = () => {
  const {
    modules,
    selectedRole,
    userEmail,
    recordRoleName,
    token
  } = useWorkspace();

  return (
    <DashboardPage
      modules={modules}
      role={selectedRole}
      userEmail={userEmail}
      roleName={recordRoleName}
      token={token}
    />
  );
};