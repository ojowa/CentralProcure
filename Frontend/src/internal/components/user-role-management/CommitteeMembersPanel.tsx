'use client';

import React, { useMemo, useState } from 'react';
import type { InternalRoleRecord, InternalUserProfile } from '../../types/internal';
import { resolveRole } from '../../services/internalAuthService';
import { fetchPlanningCommitteeRoleDefinitions, type PlanningCommitteeRoleDefinition } from '../../services/moduleService';

interface CommitteeMembersPanelProps {
  roles: InternalRoleRecord[];
  users: InternalUserProfile[];
  token?: string | null;
  isLoading: boolean;
  onAssignRole: (userId: string, roleName: string) => void | Promise<void>;
}

export const CommitteeMembersPanel: React.FC<CommitteeMembersPanelProps> = ({
  roles,
  users,
  token,
  isLoading,
  onAssignRole
}) => {
  const [selectionByRole, setSelectionByRole] = useState<Record<string, string>>({});
  const [replacementRoleByUser, setReplacementRoleByUser] = useState<Record<string, string>>({});
  const [committeeRoles, setCommitteeRoles] = useState<PlanningCommitteeRoleDefinition[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!token) {
      setCommitteeRoles([]);
      return;
    }

    let isMounted = true;
    setRolesLoading(true);
    setRolesError(null);
    fetchPlanningCommitteeRoleDefinitions(token)
      .then((data) => {
        if (isMounted) {
          setCommitteeRoles(data);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setCommitteeRoles([]);
          setRolesError(err instanceof Error ? err.message : 'Unable to load committee role definitions from backend.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setRolesLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const fallbackCommitteeRoles = useMemo(() => {
    const allowed = new Set([
      'comptroller_procurement',
      'procurement_secretary',
      'planning_statistics_officer',
      'financial_unit_officer',
      'department_head',
      'legal_reviewer'
    ]);

    const mapped: PlanningCommitteeRoleDefinition[] = [];
    for (const role of roles) {
      const roleKey = resolveRole(role.RoleName);
      if (!roleKey || !allowed.has(roleKey)) {
        continue;
      }

      if (mapped.some((entry) => entry.RoleKey === roleKey)) {
        continue;
      }

      mapped.push({
        RoleKey: roleKey,
        RoleName: role.RoleName,
        DisplayName: role.RoleName,
        Description: role.Description ?? '',
        IsChair: roleKey === 'comptroller_procurement'
      });
    }

    return mapped;
  }, [roles]);

  const effectiveCommitteeRoles = committeeRoles.length ? committeeRoles : fallbackCommitteeRoles;
  const showRolesError = Boolean(rolesError) && effectiveCommitteeRoles.length === 0;
  const committeeRoleNames = useMemo(
    () => new Set(effectiveCommitteeRoles.map((role) => role.RoleName)),
    [effectiveCommitteeRoles]
  );

  const assignableUsers = useMemo(
    () => users.filter((user) => user.Status?.toLowerCase() !== 'inactive'),
    [users]
  );

  const removableToRoles = useMemo(
    () =>
      roles.filter((role) => role.IsActive && !committeeRoleNames.has(role.RoleName)),
    [committeeRoleNames, roles]
  );

  return (
    <article className="portal-module-card">
      <h3>Planning Committee Members</h3>
      <p className="plan-muted">
        Manage committee composition with named roles instead of manual role keys.
      </p>
      <p className="plan-muted" style={{ marginTop: '6px' }}>
        To remove someone from the committee, move them to another non-committee role.
      </p>

      <div className="roles-grid" style={{ marginTop: '16px' }}>
        {effectiveCommitteeRoles.map((roleConfig) => {
          const members = users.filter((user) => resolveRole(user.RoleName) === roleConfig.RoleKey);
          const selectedUserId = selectionByRole[roleConfig.RoleKey] ?? '';

          return (
            <article key={roleConfig.RoleKey} className="portal-module-card" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                <h3 style={{ margin: 0 }}>{roleConfig.DisplayName}</h3>
                <span className={`admin-status ${members.length ? 'admin-status--good' : 'admin-status--warn'}`}>
                  {members.length} member{members.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="plan-muted" style={{ marginTop: '6px' }}>
                {roleConfig.Description || 'Committee role configured from backend.'}
              </p>
              <p className="plan-muted" style={{ marginTop: '4px' }}>
                Backend role: <strong>{roleConfig.RoleName}</strong>
              </p>

              <div style={{ marginTop: '10px' }}>
                {members.length ? (
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {members.map((member) => {
                      const replacementRole = replacementRoleByUser[member.InternalUserId] ?? '';

                      return (
                        <li key={member.InternalUserId} style={{ marginBottom: '12px' }}>
                          <div>
                            {member.Email} ({member.Username})
                          </div>
                          <div className="plan-toolbar" style={{ marginTop: '8px' }}>
                            <label className="plan-field">
                              <span>Move To Role</span>
                              <select
                                className="plan-input"
                                value={replacementRole}
                                onChange={(event) =>
                                  setReplacementRoleByUser((current) => ({
                                    ...current,
                                    [member.InternalUserId]: event.target.value
                                  }))
                                }
                                disabled={isLoading || rolesLoading}
                              >
                                <option value="">Select replacement role</option>
                                {removableToRoles.map((role) => (
                                  <option key={role.RoleId} value={role.RoleName}>
                                    {role.RoleName}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div>
                              <button
                                type="button"
                                className="plan-button plan-button--ghost"
                                disabled={isLoading || rolesLoading || !replacementRole}
                                onClick={() => {
                                  if (!replacementRole) {
                                    return;
                                  }

                                  const confirmed = window.confirm(
                                    `Remove ${member.Email} from ${roleConfig.DisplayName} and assign ${replacementRole}?`
                                  );

                                  if (confirmed) {
                                    void onAssignRole(member.InternalUserId, replacementRole);
                                  }
                                }}
                              >
                                Remove Member
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="plan-empty" style={{ textAlign: 'left', padding: '6px 0' }}>
                    No member currently assigned.
                  </div>
                )}
              </div>

              <div className="plan-toolbar" style={{ marginTop: '10px' }}>
                <label className="plan-field">
                  <span>Select User To Assign</span>
                  <select
                    className="plan-input"
                    value={selectedUserId}
                    onChange={(event) =>
                      setSelectionByRole((current) => ({
                        ...current,
                        [roleConfig.RoleKey]: event.target.value
                      }))
                    }
                    disabled={isLoading || rolesLoading}
                  >
                    <option value="">Select user</option>
                    {assignableUsers.map((user) => (
                      <option key={user.InternalUserId} value={user.InternalUserId}>
                        {user.Email} ({user.RoleName})
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <button
                    type="button"
                    className="plan-button"
                    disabled={isLoading || rolesLoading || !selectedUserId}
                    onClick={() => selectedUserId && onAssignRole(selectedUserId, roleConfig.RoleName)}
                  >
                    Assign Member
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {showRolesError ? <div className="portal-alert">{rolesError}</div> : null}
      {!effectiveCommitteeRoles.length && !rolesLoading ? (
        <div className="plan-empty" style={{ textAlign: 'left' }}>
          No planning committee roles available.
        </div>
      ) : null}
    </article>
  );
};
