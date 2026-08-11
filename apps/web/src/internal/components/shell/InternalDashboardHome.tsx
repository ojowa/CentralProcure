'use client';

import { useWorkspace } from './InternalWorkspaceContext';
import { DashboardPage } from '../dashboard/DashboardPage';

export const InternalDashboardHome = () => {
  const {
    modules,
    selectedRole,
    userEmail,
    userFirstName,
    userSurname,
    recordRoleName,
    token
  } = useWorkspace();

  return (
    <DashboardPage
      role={selectedRole}
      userEmail={userEmail}
      userFirstName={userFirstName}
      userSurname={userSurname}
      roleName={recordRoleName}
      token={token}
    />
  );
};