'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { InternalModule, InternalUserProfile, InternalRoleRecord } from '../../types/internal';
import type { ModuleAccessMode, ModuleGrant } from '../../hooks/useModuleAccess';
import type { RoleModuleAccessGrant, UserModuleAccessGrant } from '../../services/internalAuthService';
import { AccessAuditPanel } from './AccessAuditPanel';
import { useAccessAuditWithTarget } from '../../hooks/useAccessAudit';

interface ModuleAccessPanelProps {
  modules: InternalModule[];
  roles: InternalRoleRecord[];
  users: InternalUserProfile[];
  token?: string | null;
  roleModuleGrants: RoleModuleAccessGrant[];
  userModuleGrants: UserModuleAccessGrant[];
  isLoading: boolean;
  onUpdateRoleGrant: (roleName: string, moduleId: string, isEnabled: boolean) => void | Promise<void>;
  onUpdateUserGrant: (userId: string, moduleId: string, isEnabled: boolean) => void | Promise<void>;
  onDeleteRoleGrant: (roleName: string, moduleId: string) => void | Promise<void>;
  onDeleteUserGrant: (userId: string, moduleId: string) => void | Promise<void>;
  onBulkUpdateRoleGrants: (roleName: string, grants: ModuleGrant[]) => void | Promise<void>;
  onBulkUpdateUserGrants: (userId: string, grants: ModuleGrant[]) => void | Promise<void>;
  onBulkResetRoleGrants: (roleName: string) => void | Promise<void>;
  onBulkResetUserGrants: (userId: string) => void | Promise<void>;
}

export const ModuleAccessPanel: React.FC<ModuleAccessPanelProps> = ({
  modules,
  roles,
  users,
  token,
  roleModuleGrants,
  userModuleGrants,
  isLoading,
  onUpdateRoleGrant,
  onUpdateUserGrant,
  onDeleteRoleGrant,
  onDeleteUserGrant,
  onBulkUpdateRoleGrants,
  onBulkUpdateUserGrants,
  onBulkResetRoleGrants,
  onBulkResetUserGrants
}) => {
  const [mode, setMode] = useState<ModuleAccessMode>('role');
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.RoleName ?? '');
  const [selectedUser, setSelectedUser] = useState<string>(users[0]?.InternalUserId ?? '');
  const [query, setQuery] = useState('');

  // Use the dedicated audit hook
  const {
    entries: auditEntries,
    isLoading: isLoadingAudit,
    refresh: refreshAudit,
    exportToCsv: exportAuditCsv
  } = useAccessAuditWithTarget(
    token,
    mode,
    mode === 'role' ? selectedRole : selectedUser
  );

  const roleGrantMap = useMemo(() => {
    const map = new Map<string, RoleModuleAccessGrant>();
    for (const grant of roleModuleGrants) {
      if (grant.RoleName === selectedRole) {
        map.set(grant.ModuleId, grant);
      }
    }
    return map;
  }, [roleModuleGrants, selectedRole]);

  const userGrantMap = useMemo(() => {
    const map = new Map<string, UserModuleAccessGrant>();
    for (const grant of userModuleGrants) {
      if (grant.InternalUserId === selectedUser) {
        map.set(grant.ModuleId, grant);
      }
    }
    return map;
  }, [userModuleGrants, selectedUser]);

  const handleModeChange = useCallback((newMode: ModuleAccessMode) => {
    setMode(newMode);
  }, []);

  const handleRoleChange = useCallback((roleName: string) => {
    setSelectedRole(roleName);
  }, []);

  const handleUserChange = useCallback((userId: string) => {
    setSelectedUser(userId);
  }, []);

  useEffect(() => {
    if (!selectedRole && roles.length > 0) {
      setSelectedRole(roles[0].RoleName);
    }
  }, [roles, selectedRole]);

  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      setSelectedUser(users[0].InternalUserId);
    }
  }, [users, selectedUser]);

  const handleAllowAll = async () => {
    const grants = modules.map(m => ({ ModuleId: m.id, IsEnabled: true }));
    if (mode === 'role') {
      await onBulkUpdateRoleGrants(selectedRole, grants);
    } else {
      await onBulkUpdateUserGrants(selectedUser, grants);
    }
  };

  const handleDenyAll = async () => {
    const grants = modules.map(m => ({ ModuleId: m.id, IsEnabled: false }));
    if (mode === 'role') {
      await onBulkUpdateRoleGrants(selectedRole, grants);
    } else {
      await onBulkUpdateUserGrants(selectedUser, grants);
    }
  };

  const handleResetAll = async () => {
    if (mode === 'role') {
      await onBulkResetRoleGrants(selectedRole);
    } else {
      await onBulkResetUserGrants(selectedUser);
    }
  };

  const effectiveLoading = isLoading || isLoadingAudit;
  const activeGrantMap = mode === 'role' ? roleGrantMap : userGrantMap;
  const selectedUserRecord = users.find((user) => user.InternalUserId === selectedUser) ?? null;
  const targetLabel = mode === 'role'
    ? (selectedRole || 'No role selected')
    : (selectedUserRecord ? `${selectedUserRecord.Email} (${selectedUserRecord.RoleName})` : 'No user selected');

  const normalizedQuery = query.trim().toLowerCase();
  const filteredModules = useMemo(() => {
    if (!normalizedQuery) {
      return modules;
    }

    return modules.filter((module) => {
      return module.title.toLowerCase().includes(normalizedQuery) ||
        module.section.toLowerCase().includes(normalizedQuery) ||
        module.id.toLowerCase().includes(normalizedQuery);
    });
  }, [modules, normalizedQuery]);

  const summary = useMemo(() => {
    let allowed = 0;
    let denied = 0;

    for (const mod of modules) {
      const grant = activeGrantMap.get(mod.id);
      if (!grant) {
        continue;
      }

      if (grant.IsEnabled) {
        allowed += 1;
      } else {
        denied += 1;
      }
    }

    return {
      total: modules.length,
      allowed,
      denied,
      default: Math.max(0, modules.length - allowed - denied)
    };
  }, [modules, activeGrantMap]);

  return (
    <article className="portal-module-card module-access">
      <section className="module-access__guide">
        <h4>How To Use This Page</h4>
        <p><strong>Step 1:</strong> Choose <em>By Role</em> or <em>By User</em>.</p>
        <p><strong>Step 2:</strong> Pick the role/user you want to edit.</p>
        <p><strong>Step 3:</strong> For each module, click <em>Grant Access</em>, <em>Block Access</em>, or <em>Use Default</em>.</p>
        <p className="plan-muted"><strong>Default</strong> means the system uses the normal catalog rules.</p>
      </section>

      <div className="module-access__header">
        <div>
          <h3>Module Access Control</h3>
          <p className="plan-muted">Currently editing: {targetLabel}</p>
        </div>
        <div className="module-access__mode-toggle">
          <button
            type="button"
            className={`plan-button ${mode === 'role' ? '' : 'plan-button--secondary'}`}
            onClick={() => handleModeChange('role')}
            disabled={effectiveLoading}
          >
            By Role
          </button>
          <button
            type="button"
            className={`plan-button ${mode === 'user' ? '' : 'plan-button--secondary'}`}
            onClick={() => handleModeChange('user')}
            disabled={effectiveLoading}
          >
            By User
          </button>
        </div>
      </div>

      <div className="module-access__toolbar">
        {mode === 'role' ? (
          <label className="plan-field">
            <span>Step 1: Select Role</span>
            <select
              className="plan-input"
              value={selectedRole}
              onChange={(e) => handleRoleChange(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role.RoleId} value={role.RoleName}>{role.RoleName}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="plan-field">
            <span>Step 1: Select User</span>
            <select
              className="plan-input"
              value={selectedUser}
              onChange={(e) => handleUserChange(e.target.value)}
            >
              {users.map((user) => (
                <option key={user.InternalUserId} value={user.InternalUserId}>
                  {user.Email} ({user.RoleName})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="plan-field">
          <span>Step 2: Search Modules (Optional)</span>
          <input
            className="plan-input"
            placeholder="Filter by module, section, or id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="module-access__bulk-actions">
          <button type="button" className="plan-button plan-button--secondary" onClick={handleAllowAll} disabled={effectiveLoading}>
            Grant All
          </button>
          <button type="button" className="plan-button plan-button--secondary" onClick={handleDenyAll} disabled={effectiveLoading}>
            Block All
          </button>
          <button type="button" className="plan-button" onClick={handleResetAll} disabled={effectiveLoading}>
            Use Default For All
          </button>
        </div>
      </div>

      <div className="module-access__summary">
        <div className="module-access__metric">
          <strong>{summary.total}</strong>
          <span>Total Modules</span>
        </div>
        <div className="module-access__metric module-access__metric--good">
          <strong>{summary.allowed}</strong>
          <span>Explicitly Allowed</span>
        </div>
        <div className="module-access__metric module-access__metric--warn">
          <strong>{summary.denied}</strong>
          <span>Explicitly Blocked</span>
        </div>
        <div className="module-access__metric">
          <strong>{summary.default}</strong>
          <span>Using Default Rule</span>
        </div>
      </div>

      <div className="module-access__grid">
        {filteredModules.map((module) => {
          const grant = activeGrantMap.get(module.id);
          const statusLabel = grant ? (grant.IsEnabled ? 'Allowed' : 'Denied') : 'Default';
          const statusClass = grant ? (grant.IsEnabled ? 'admin-status--good' : 'admin-status--warn') : '';

          return (
            <article key={module.id} className="module-access__card">
              <header className="module-access__card-head">
                <div>
                  <h4>{module.title}</h4>
                  <p>{module.section}</p>
                </div>
                <span className={`admin-status ${statusClass}`}>{statusLabel}</span>
              </header>

              <div className="module-access__card-meta">{module.id}</div>
              <p className="module-access__hint">Step 3: choose one action for this module.</p>

              <div className="module-access__card-actions">
                <button
                  type="button"
                  className="plan-button plan-button--secondary"
                  onClick={() => mode === 'role'
                    ? onUpdateRoleGrant(selectedRole, module.id, true)
                    : onUpdateUserGrant(selectedUser, module.id, true)
                  }
                  disabled={effectiveLoading}
                >
                  Grant Access
                </button>
                <button
                  type="button"
                  className="plan-button plan-button--secondary"
                  onClick={() => mode === 'role'
                    ? onUpdateRoleGrant(selectedRole, module.id, false)
                    : onUpdateUserGrant(selectedUser, module.id, false)
                  }
                  disabled={effectiveLoading}
                >
                  Block Access
                </button>
                <button
                  type="button"
                  className="plan-button"
                  onClick={() => mode === 'role'
                    ? onDeleteRoleGrant(selectedRole, module.id)
                    : onDeleteUserGrant(selectedUser, module.id)
                  }
                  disabled={effectiveLoading || !grant}
                >
                  Use Default
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!filteredModules.length ? <p className="plan-empty">No modules match your filter.</p> : null}

      <AccessAuditPanel
        entries={auditEntries}
        isLoading={isLoadingAudit}
        onRefresh={refreshAudit}
        onExportCsv={exportAuditCsv}
      />
    </article>
  );
};
