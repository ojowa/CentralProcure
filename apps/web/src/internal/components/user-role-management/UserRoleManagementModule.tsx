'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { InternalModule, InternalUserProfile, InternalRoleRecord, InternalOrganizationalUnitRecord, InternalRegistrationData } from '../../types/internal';
import { useUserManagement } from '../../hooks/useUserManagement';
import { useRoleManagement } from '../../hooks/useRoleManagement';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { fetchInternalUnits, fetchInternalModulesCatalog, registerInternalUser, updateInternalUserRole } from '../../services/internalAuthService';
import { updatePlanningCommitteeChairmanAssignment } from '../../services/moduleService.planning';
import {
  UserList, RoleList, ModuleAccessPanel, EditUserModal, ResetPasswordModal,
  CreateRoleModal, EditRoleModal, OnboardingForm, CommitteeMembersPanel, EvaluationCommitteeAssignmentsPanel,
  UserRoleHistoryModal, ScheduleRoleModal, PermissionsPanel
} from './index';
import * as roleService from '../../services/roleManagementService';

type Props = { module: InternalModule; token?: string | null; };
type Tab = 'users' | 'roles' | 'modules' | 'permissions' | 'committee' | 'onboarding';
const TABS: Tab[] = ['users', 'roles', 'modules', 'permissions', 'committee', 'onboarding'];
const TAB_LABELS: Record<Tab, string> = {
  users: 'Active Directory',
  roles: 'Role Catalog',
  modules: 'Module Access',
  permissions: 'Permissions',
  committee: 'Committee Members',
  onboarding: 'User Onboarding'
};

export const UserRoleManagementModule = ({ module, token }: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [units, setUnits] = useState<InternalOrganizationalUnitRecord[]>([]);
  const [moduleCatalog, setModuleCatalog] = useState<InternalModule[]>([]);
  const [editingUser, setEditingUser] = useState<InternalUserProfile | null>(null);
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [resettingUser, setResettingUser] = useState<InternalUserProfile | null>(null);
  const [historyUser, setHistoryUser] = useState<InternalUserProfile | null>(null);
  const [schedulingUser, setSchedulingUser] = useState<InternalUserProfile | null>(null);
  const [editingRole, setEditingRole] = useState<InternalRoleRecord | null>(null);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);

  const {
    users, isLoading: isLoadingUsers, filteredUsers, searchQuery, setSearchQuery,
    activeCount, pendingCount, refreshUsers, updateUserRole, updateUser, resetPassword
  } = useUserManagement({ token });

  const { roles, isLoading: isLoadingRoles, refreshRoles, createRole, updateRole, deactivateRole } = useRoleManagement({ token });

  const {
    roleModuleGrants, userModuleGrants, isLoading: isLoadingModules,
    refreshGrants, updateRoleGrant, updateUserGrant, deleteRoleGrant, deleteUserGrant,
    bulkUpdateRoleGrants, bulkUpdateUserGrants, bulkResetRoleGrants, bulkResetUserGrants
  } = useModuleAccess({ token });

  const isLoading = isLoadingUsers || isLoadingRoles || isLoadingModules;

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && TABS.includes(requestedTab as Tab)) {
      setActiveTab(requestedTab as Tab);
      return;
    }

    setActiveTab('users');
  }, [searchParams]);

  useEffect(() => {
    if (!token) return;
    const loadData = async () => {
      try {
        const [unitsData, modulesData] = await Promise.all([
          fetchInternalUnits(), fetchInternalModulesCatalog(token)
        ]);
        setUnits(unitsData);
        setModuleCatalog(modulesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load initial data');
      }
    };
    void loadData();
  }, [token]);

  useEffect(() => { setError(null); setSuccess(null); }, [activeTab]);
  useEffect(() => { setEditUserError(null); }, [editingUser]);

  const showError = (msg: string) => setError(msg);
  const showSuccess = (msg: string) => setSuccess(msg);
  const clearMessages = () => { setError(null); setSuccess(null); };
  const setTab = (tab: Tab) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('tab', tab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const handleOnboard = async (data: Omit<InternalRegistrationData, 'ConfirmPassword'>) => {
    if (!token) return;
    clearMessages();
    try {
      await registerInternalUser({
        ...data,
        ConfirmPassword: data.Password
      });
      showSuccess(`User ${data.Email} onboarded successfully.`);
      await refreshUsers();
      setTab('users');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to onboard user.');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    clearMessages();
    try { await updateUserRole(userId, newRole); showSuccess('User role updated successfully.'); }
    catch (err) { showError(err instanceof Error ? err.message : 'Failed to update role.'); }
  };

  const handleEditUser = async (userId: string, data: Parameters<typeof updateUser>[1]) => {
    clearMessages();
    setEditUserError(null);
    try { await updateUser(userId, data); setEditingUser(null); showSuccess('User updated successfully.'); }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user.';
      setEditUserError(message);
      showError(message);
    }
  };

  const handleResetPassword = async (userId: string, newPassword: string) => {
    clearMessages();
    try { await resetPassword(userId, newPassword, true); setResettingUser(null); showSuccess('Password reset successfully.'); }
    catch (err) { showError(err instanceof Error ? err.message : 'Failed to reset password.'); }
  };

  const handleConfirmSchedule = async (data: {
    Role: string;
    EffectiveFrom?: string | null;
    ExpiresAt?: string | null;
    BackupRole?: string | null;
  }) => {
    if (!schedulingUser || !token) return;
    clearMessages();
    try {
      await updateInternalUserRole(token, {
        InternalUserId: schedulingUser.InternalUserId,
        ...data
      });
      setSchedulingUser(null);
      showSuccess('Role schedule updated successfully.');
      await refreshUsers();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update role schedule.');
    }
  };

  const handleCreateRole = async (data: roleService.CreateRoleRequest) => {
    clearMessages();
    try { await createRole(data); setIsCreateRoleOpen(false); showSuccess('Role created successfully.'); }
    catch (err) { showError(err instanceof Error ? err.message : 'Failed to create role.'); }
  };

  const handleEditRole = async (roleId: string, data: roleService.UpdateRoleRequest) => {
    clearMessages();
    try { await updateRole(roleId, data); setEditingRole(null); showSuccess('Role updated successfully.'); }
    catch (err) { showError(err instanceof Error ? err.message : 'Failed to update role.'); }
  };

  const handleDeactivateRole = async (role: InternalRoleRecord) => {
    if (!confirm(`Deactivate role "${role.RoleName}"?`)) return;
    clearMessages();
    try { await deactivateRole(role.RoleId); showSuccess('Role deactivated successfully.'); }
    catch (err) { showError(err instanceof Error ? err.message : 'Failed to deactivate role.'); }
  };

  const handleAssignCommitteeMember = async (userId: string, roleName: string) => {
    clearMessages();
    try {
      await updateUserRole(userId, roleName);
      const normalizedRole = roleName.trim().toLowerCase().replace(/[_\s-]+/g, '');
      showSuccess(
        normalizedRole === 'comptrollerprocurement'
          ? 'Planning Committee Chairman assigned successfully.'
          : `Committee assignment updated: ${roleName}.`
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to assign committee member.');
    }
  };

  const handleAssignCommitteeChairman = async (userId: string | null) => {
    if (!token) {
      showError('Authentication is required to assign the planning committee chairman.');
      return;
    }

    clearMessages();
    try {
      await updatePlanningCommitteeChairmanAssignment(token, userId);
      showSuccess(
        userId
          ? 'Planning Committee Chairman assigned successfully.'
          : 'Planning Committee Chairman assignment cleared successfully.'
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to assign planning committee chairman.');
    }
  };

  const refreshAll = async () => {
    clearMessages();
    await Promise.all([refreshUsers(), refreshGrants()]);
    showSuccess('Data refreshed successfully.');
  };

  return (
    <section className="admin-hub animate-fade-up">
      <header className="admin-hero">
        <div>
          <div className="admin-kicker">{module.controlPurpose}</div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
          <div className="admin-tags">
            <span className="admin-tag">{users.length} Active Users</span>
            <span className="admin-tag">{roles.length} Defined Roles</span>
            <span className="admin-tag">{units.length} Organizational Units</span>
          </div>
        </div>
        <div className="admin-metrics">
          <div className="admin-metric"><strong>{activeCount}</strong><span>Active</span></div>
          <div className="admin-metric"><strong>{pendingCount}</strong><span>Pending</span></div>
        </div>
      </header>

      {error && <div className="portal-alert animate-shake">{error}</div>}
      {success && <div className="plan-success">{success}</div>}

      <div className="workflow-config-tabs">
        {TABS.map(tab => (
          <Link
            key={tab}
            href={`${pathname}?tab=${tab}`}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setTab(tab)}
          >
            {TAB_LABELS[tab]}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <button type="button" className="workflow-config-refresh" onClick={refreshAll} disabled={isLoading}>
          {isLoading ? 'Syncing...' : 'Refresh Directory'}
        </button>
      </div>

      <div className="management-viewport" style={{ marginTop: '24px' }}>
        {activeTab === 'users' && (
          <UserList users={filteredUsers} roles={roles} isLoading={isLoading} onRoleChange={handleRoleChange}
            onScheduleRole={setSchedulingUser}
            onEditUser={setEditingUser} onResetPassword={setResettingUser} onViewHistory={setHistoryUser}
            searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        )}

        {activeTab === 'roles' && (
          <RoleList roles={roles} users={users} isLoading={isLoading}
            onEditRole={setEditingRole} onCreateRole={() => setIsCreateRoleOpen(true)}
            onDeactivateRole={handleDeactivateRole} />
        )}

        {activeTab === 'modules' && (
          <ModuleAccessPanel modules={moduleCatalog} roles={roles} users={users} token={token}
            roleModuleGrants={roleModuleGrants} userModuleGrants={userModuleGrants}
            isLoading={isLoading}
            onUpdateRoleGrant={updateRoleGrant} onUpdateUserGrant={updateUserGrant}
            onDeleteRoleGrant={deleteRoleGrant} onDeleteUserGrant={deleteUserGrant}
            onBulkUpdateRoleGrants={bulkUpdateRoleGrants} onBulkUpdateUserGrants={bulkUpdateUserGrants}
            onBulkResetRoleGrants={bulkResetRoleGrants} onBulkResetUserGrants={bulkResetUserGrants} />
        )}

        {activeTab === 'permissions' && (
          <PermissionsPanel roles={roles} token={token} />
        )}

        {activeTab === 'committee' && (
          <>
            <CommitteeMembersPanel
              roles={roles}
              users={users}
              token={token}
              isLoading={isLoading}
              onAssignRole={handleAssignCommitteeMember}
              onAssignChairman={handleAssignCommitteeChairman}
            />
            <EvaluationCommitteeAssignmentsPanel
              token={token}
              users={users}
              isLoading={isLoading}
            />
          </>
        )}

        {activeTab === 'onboarding' && (
          <OnboardingForm roles={roles} units={units} isLoading={isLoading} onSubmit={handleOnboard} />
        )}
      </div>

      <EditUserModal user={editingUser} roles={roles} units={units} isOpen={!!editingUser}
        isLoading={isLoading} errorMessage={editUserError}
        onClose={() => { setEditingUser(null); setEditUserError(null); }}
        onSave={handleEditUser} />

      <ResetPasswordModal user={resettingUser} isOpen={!!resettingUser}
        isLoading={isLoading} onClose={() => setResettingUser(null)} onConfirm={handleResetPassword} />

      <CreateRoleModal isOpen={isCreateRoleOpen} isLoading={isLoading}
        onClose={() => setIsCreateRoleOpen(false)} onConfirm={handleCreateRole} />

      <EditRoleModal role={editingRole} isOpen={!!editingRole} isLoading={isLoading}
        onClose={() => setEditingRole(null)} onConfirm={handleEditRole} />

      <UserRoleHistoryModal user={historyUser} isOpen={!!historyUser} token={token}
        onClose={() => setHistoryUser(null)} />

      <ScheduleRoleModal user={schedulingUser} roles={roles} isOpen={!!schedulingUser}
        isLoading={isLoading} onClose={() => setSchedulingUser(null)}
        onConfirm={handleConfirmSchedule} />
    </section>
  );
};
