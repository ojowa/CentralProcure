'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { InternalModule, InternalUserProfile, InternalRoleRecord, InternalRegistrationData } from '../../types/internal';
import { useUserManagement } from '../../hooks/useUserManagement';
import { useRoleManagement } from '../../hooks/useRoleManagement';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { useInitialData } from '../../hooks/useInitialData';
import { registerInternalUser, updateInternalUserRole } from '../../services/internalAuthService';
import { updatePlanningCommitteeChairmanAssignment } from '../../services/moduleService.planning';
import {
  UserList, RoleList, ModuleAccessPanel, EditUserModal, ResetPasswordModal,
  CreateRoleModal, EditRoleModal, OnboardingForm, CommitteeMembersPanel, EvaluationCommitteeAssignmentsPanel,
  UserRoleHistoryModal, ScheduleRoleModal, PermissionsPanel, ConfirmModal
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
  const [editingUser, setEditingUser] = useState<InternalUserProfile | null>(null);
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [resettingUser, setResettingUser] = useState<InternalUserProfile | null>(null);
  const [historyUser, setHistoryUser] = useState<InternalUserProfile | null>(null);
  const [schedulingUser, setSchedulingUser] = useState<InternalUserProfile | null>(null);
  const [editingRole, setEditingRole] = useState<InternalRoleRecord | null>(null);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'role'; data: InternalRoleRecord } | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const {
    users, isLoading: isLoadingUsers, filteredUsers, searchQuery, setSearchQuery,
    activeCount, pendingCount, refreshUsers, updateUserRole, updateUser, resetPassword
  } = useUserManagement({ token });

  const { roles, isLoading: isLoadingRoles, refreshRoles, createRole, updateRole, deactivateRole } = useRoleManagement({ token });

  const {
    roleModuleGrants, userModuleGrants, isLoading: isLoadingModules,
    refreshGrants, updateRoleGrant, updateUserGrant
  } = useModuleAccess({ token });

  const { units, moduleCatalog, isLoading: isLoadingInitial } = useInitialData(token);

  const isLoading = isLoadingUsers || isLoadingRoles || isLoadingModules || isLoadingInitial;

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && TABS.includes(requestedTab as Tab)) {
      setActiveTab(requestedTab as Tab);
      return;
    }

    setActiveTab('users');
  }, [searchParams]);

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

  const handleResetPassword = async (userId: string, newPassword: string, requireChange: boolean) => {
    clearMessages();
    try { await resetPassword(userId, newPassword, requireChange); setResettingUser(null); showSuccess('Password reset successfully.'); }
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
    clearMessages();
    try { await deactivateRole(role.RoleId); showSuccess('Role deactivated successfully.'); }
    catch (err) { showError(err instanceof Error ? err.message : 'Failed to deactivate role.'); }
  };

  const handleAssignCommitteeMember = async (userId: string, roleKey: string) => {
    clearMessages();
    try {
      await updateUserRole(userId, roleKey);
      showSuccess(`Committee assignment updated: ${roleKey}.`);
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

  const handleExportCsv = () => {
    const headers = ['Name', 'Email', 'Username', 'Service Number', 'Role', 'Unit', 'Status', 'Last Login'];
    const rows = users.map(u => [
      `${u.FirstName} ${u.Surname}`,
      u.Email,
      u.Username,
      u.ServiceNumber,
      u.RoleName,
      u.UnitName || '',
      u.Status,
      u.LastLogin ? new Date(u.LastLogin).toLocaleDateString() : 'Never'
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSelectAllUsers = (userIds: string[]) => {
    setSelectedUserIds(new Set(userIds));
  };

  const handleBulkRoleChange = async (roleKey: string) => {
    clearMessages();
    let successCount = 0;
    let failCount = 0;
    for (const userId of selectedUserIds) {
      try {
        await updateUserRole(userId, roleKey);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setSelectedUserIds(new Set());
    if (failCount === 0) showSuccess(`Updated ${successCount} user(s) successfully.`);
    else showError(`Updated ${successCount} user(s), ${failCount} failed.`);
  };

  const handleBulkDeactivate = async () => {
    clearMessages();
    let successCount = 0;
    let failCount = 0;
    for (const userId of selectedUserIds) {
      try {
        await updateUser(userId, { Status: 'Inactive' } as any);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setSelectedUserIds(new Set());
    if (failCount === 0) showSuccess(`Deactivated ${successCount} user(s) successfully.`);
    else showError(`Deactivated ${successCount} user(s), ${failCount} failed.`);
  };

  return (
    <section className="admin-hub animate-fade-up">
      <header className="urm-header">
        <div className="urm-header__top">
          <div className="urm-header__title-group">
            <div className="urm-kicker">{module.controlPurpose}</div>
            <h2 className="urm-header__title">{module.title}</h2>
            <p className="urm-header__desc">{module.description}</p>
          </div>
          <div className="urm-header__stats">
            <div className="urm-stat urm-stat--primary">
              <strong>{activeCount}</strong>
              <span>Active Users</span>
            </div>
            <div className="urm-stat urm-stat--muted">
              <strong>{pendingCount}</strong>
              <span>Pending</span>
            </div>
            <div className="urm-stat urm-stat--accent">
              <strong>{roles.length}</strong>
              <span>Roles</span>
            </div>
            <div className="urm-stat urm-stat--accent">
              <strong>{units.length}</strong>
              <span>Units</span>
            </div>
          </div>
        </div>
      </header>

      {error && <div className="portal-alert animate-shake">{error}</div>}
      {success && <div className="plan-success">{success}</div>}

      <nav className="urm-nav">
        <div className="urm-nav__tabs">
          {TABS.map(tab => (
            <Link
              key={tab}
              href={`${pathname}?tab=${tab}`}
              className={`urm-nav__tab ${activeTab === tab ? 'urm-nav__tab--active' : ''}`}
              onClick={() => setTab(tab)}
            >
              {TAB_LABELS[tab]}
            </Link>
          ))}
        </div>
        <button type="button" className="urm-nav__refresh" onClick={refreshAll} disabled={isLoading}>
          {isLoading ? 'Syncing...' : 'Refresh Directory'}
        </button>
      </nav>

      <div className="management-viewport" style={{ marginTop: '24px' }}>
        {activeTab === 'users' && (
          <UserList users={filteredUsers} roles={roles} units={units} isLoading={isLoading}
            onRoleChange={handleRoleChange}
            onScheduleRole={setSchedulingUser}
            onEditUser={setEditingUser} onResetPassword={setResettingUser} onViewHistory={setHistoryUser}
            searchQuery={searchQuery} onSearchChange={setSearchQuery}
            onExportCsv={handleExportCsv}
            selectedUserIds={selectedUserIds}
            onToggleUserSelection={handleToggleUserSelection}
            onSelectAllUsers={handleSelectAllUsers}
            onBulkRoleChange={handleBulkRoleChange}
            onBulkDeactivate={handleBulkDeactivate} />
        )}

        {activeTab === 'roles' && (
          <RoleList roles={roles} users={users} isLoading={isLoading}
            onEditRole={setEditingRole} onCreateRole={() => setIsCreateRoleOpen(true)}
            onDeactivateRole={(role) => setConfirmDelete({ type: 'role', data: role })} />
        )}

        {activeTab === 'modules' && (
          <ModuleAccessPanel modules={moduleCatalog} roles={roles} users={users} token={token}
            roleModuleGrants={roleModuleGrants} userModuleGrants={userModuleGrants}
            isLoading={isLoading}
            onUpdateRoleGrant={updateRoleGrant} onUpdateUserGrant={updateUserGrant} />
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

      <ConfirmModal
        isOpen={confirmDelete?.type === 'role'}
        title="Deactivate Role"
        message={confirmDelete?.type === 'role' ? `Deactivate role "${confirmDelete.data.RoleName}"? Users with this role will need reassignment.` : ''}
        confirmLabel="Deactivate"
        variant="danger"
        isLoading={isLoading}
        onConfirm={async () => {
          if (confirmDelete?.type === 'role') {
            await handleDeactivateRole(confirmDelete.data);
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
};
