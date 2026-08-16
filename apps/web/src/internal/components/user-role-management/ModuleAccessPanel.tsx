'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { InternalModule, InternalUserProfile, InternalRoleRecord } from '../../types/internal';
import type { ModuleAccessMode } from '../../hooks/useModuleAccess';
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
}

type GrantState = 'allowed' | 'blocked';

const GRANT_ORDER: GrantState[] = ['allowed', 'blocked'];

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
}) => {
  const [mode, setMode] = useState<ModuleAccessMode>('role');
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.RoleName ?? '');
  const [selectedUser, setSelectedUser] = useState<string>(users[0]?.InternalUserId ?? '');
  const [query, setQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [busyModules, setBusyModules] = useState<Set<string>>(new Set());

  const effectiveRole = selectedRole || roles[0]?.RoleName || '';
  const effectiveUser = selectedUser || users[0]?.InternalUserId || '';

  const {
    entries: auditEntries,
    isLoading: isLoadingAudit,
    refresh: refreshAudit,
    exportToCsv: exportAuditCsv
  } = useAccessAuditWithTarget(
    token,
    mode,
    mode === 'role' ? effectiveRole : effectiveUser
  );

  const roleGrantMap = useMemo(() => {
    const map = new Map<string, RoleModuleAccessGrant>();
    for (const grant of roleModuleGrants) {
      if (grant.RoleName === effectiveRole) {
        map.set(grant.ModuleId, grant);
      }
    }
    return map;
  }, [roleModuleGrants, effectiveRole]);

  const userGrantMap = useMemo(() => {
    const map = new Map<string, UserModuleAccessGrant>();
    for (const grant of userModuleGrants) {
      if (grant.InternalUserId === effectiveUser) {
        map.set(grant.ModuleId, grant);
      }
    }
    return map;
  }, [userModuleGrants, effectiveUser]);

  const activeGrantMap = mode === 'role' ? roleGrantMap : userGrantMap;
  const selectedUserRecord = users.find((user) => user.InternalUserId === effectiveUser) ?? null;
  const targetLabel = mode === 'role'
    ? (effectiveRole || 'No role selected')
    : (selectedUserRecord ? `${selectedUserRecord.Email} (${selectedUserRecord.RoleName})` : 'No user selected');

  const getGrantState = useCallback((moduleId: string): GrantState => {
    const grant = activeGrantMap.get(moduleId);
    if (!grant) return 'blocked';
    return grant.IsEnabled ? 'allowed' : 'blocked';
  }, [activeGrantMap]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredModules = useMemo(() => {
    if (!normalizedQuery) {
      return modules;
    }
    return modules.filter((mod) => {
      return mod.title.toLowerCase().includes(normalizedQuery) ||
        mod.section.toLowerCase().includes(normalizedQuery) ||
        mod.id.toLowerCase().includes(normalizedQuery);
    });
  }, [modules, normalizedQuery]);

  const groupedBySection = useMemo(() => {
    const sections = new Map<string, InternalModule[]>();
    for (const mod of filteredModules) {
      const key = mod.section?.trim() || mod.group || 'Other';
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key)!.push(mod);
    }
    return Array.from(sections.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredModules]);

  const summary = useMemo(() => {
    let allowed = 0;
    let blocked = 0;
    for (const mod of modules) {
      const state = getGrantState(mod.id);
      if (state === 'allowed') allowed += 1;
      else blocked += 1;
    }
    return {
      total: modules.length,
      allowed,
      blocked
    };
  }, [modules, getGrantState]);

  const runBusy = async (moduleId: string, action: () => void | Promise<void>) => {
    setBusyModules(prev => new Set(prev).add(moduleId));
    try {
      await action();
    } finally {
      setBusyModules(prev => {
        const next = new Set(prev);
        next.delete(moduleId);
        return next;
      });
    }
  };

  const handleSetState = (moduleId: string, state: GrantState) => {
    if (mode === 'role') {
      void runBusy(moduleId, () => onUpdateRoleGrant(effectiveRole, moduleId, state === 'allowed'));
    } else {
      void runBusy(moduleId, () => onUpdateUserGrant(effectiveUser, moduleId, state === 'allowed'));
    }
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const effectiveLoading = isLoading || isLoadingAudit;

  return (
    <article className="portal-module-card urm-workspace">
      <div className="urm-contextbar">
        {mode === 'role' ? (
          <label className="plan-field">
            <span>Select Role</span>
            <select className="plan-input" value={effectiveRole} onChange={(e) => setSelectedRole(e.target.value)}>
              {roles.map((role) => (
                <option key={role.RoleId} value={role.RoleName}>{role.RoleName}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="plan-field">
            <span>Select User</span>
            <select className="plan-input" value={effectiveUser} onChange={(e) => setSelectedUser(e.target.value)}>
              {users.map((user) => (
                <option key={user.InternalUserId} value={user.InternalUserId}>
                  {user.Email} ({user.RoleName})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="plan-field">
          <span>Search Modules</span>
          <input
            className="plan-input"
            placeholder="Filter by title, section, or id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="urm-segmented" role="tablist" aria-label="Edit mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'role'}
            className={`urm-segmented__btn ${mode === 'role' ? 'urm-segmented__btn--active' : ''}`}
            onClick={() => setMode('role')}
            disabled={effectiveLoading}
          >
            By Role
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'user'}
            className={`urm-segmented__btn ${mode === 'user' ? 'urm-segmented__btn--active' : ''}`}
            onClick={() => setMode('user')}
            disabled={effectiveLoading}
          >
            By User
          </button>
        </div>
      </div>

      <div className="urm-summary">
        <div className="urm-summary__card">
          <strong className="urm-summary__value">{summary.total}</strong>
          <span className="urm-summary__label">Total Modules</span>
        </div>
        <div className="urm-summary__card urm-summary__card--good">
          <strong className="urm-summary__value">{summary.allowed}</strong>
          <span className="urm-summary__label">Allowed</span>
        </div>
        <div className="urm-summary__card urm-summary__card--warn">
          <strong className="urm-summary__value">{summary.blocked}</strong>
          <span className="urm-summary__label">Blocked</span>
        </div>
      </div>

      <div className="urm-toolbar">
        <p className="plan-muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
          Editing access for <strong>{targetLabel}</strong> &middot; choose Allow or Block per module.
        </p>
      </div>

      <div className="urm-groups">
        {groupedBySection.length === 0 ? (
          <p className="urm-empty">No modules match your search.</p>
        ) : (
          groupedBySection.map(([section, sectionModules]) => {
            const isCollapsed = collapsedSections.has(section);
            return (
              <section key={section} className="urm-group">
                <button
                  type="button"
                  className="urm-group__header"
                  onClick={() => toggleSection(section)}
                >
                  <span className="urm-group__title">
                    <span className={`urm-group__chevron ${isCollapsed ? 'urm-group__chevron--collapsed' : ''}`}>&#9660;</span>
                    {section}
                  </span>
                  <span className="urm-group__count">
                    {sectionModules.length} module{sectionModules.length === 1 ? '' : 's'}
                  </span>
                </button>

                {!isCollapsed && sectionModules.map((module) => {
                  const state = getGrantState(module.id);
                  const isBusy = busyModules.has(module.id);
                  return (
                    <div key={module.id} className="urm-module-row">
                      <div className="urm-module-row__info">
                        <div className="urm-module-row__title">{module.title}</div>
                        <div className="urm-module-row__id">{module.id}</div>
                      </div>

                      <div className="urm-module-row__status">
                        <span className={`urm-status-pill urm-status-pill--${state}`}>
                          {state === 'allowed' ? 'Allowed' : 'Blocked'}
                        </span>
                      </div>

                      <div className="urm-module-actions" role="group" aria-label={`Access for ${module.title}`}>
                        {GRANT_ORDER.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`urm-module-actions__btn ${
                              state === option
                                ? option === 'allowed'
                                  ? 'urm-module-actions__btn--active-grant'
                                  : 'urm-module-actions__btn--active-block'
                                : ''
                            }`}
                            onClick={() => handleSetState(module.id, option)}
                            disabled={effectiveLoading || isBusy || state === option}
                            aria-pressed={state === option}
                          >
                            {option === 'allowed' ? 'Allow' : 'Block'}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })
        )}
      </div>

      <AccessAuditPanel
        entries={auditEntries}
        isLoading={isLoadingAudit}
        onRefresh={refreshAudit}
        onExportCsv={exportAuditCsv}
      />
    </article>
  );
};