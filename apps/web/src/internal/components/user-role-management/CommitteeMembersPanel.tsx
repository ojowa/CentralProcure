'use client';

import React, { useMemo, useState } from 'react';
import type { InternalRoleRecord, InternalUserProfile } from '../../types/internal';
import { resolveCanonicalRole } from '../../services/internalAuthService';
import {
  fetchPlanningCommitteeRoleDefinitions,
  fetchPlanningCommitteeChairmanAssignment,
  type PlanningCommitteeChairmanAssignment,
  type PlanningCommitteeRoleDefinition
} from '../../services/moduleService.planning';

interface CommitteeMembersPanelProps {
  roles: InternalRoleRecord[];
  users: InternalUserProfile[];
  token?: string | null;
  isLoading: boolean;
  onAssignRole: (userId: string, roleKey: string) => void | Promise<void>;
  onAssignChairman: (userId: string | null) => void | Promise<void>;
}

export const CommitteeMembersPanel: React.FC<CommitteeMembersPanelProps> = ({
  roles,
  users,
  token,
  isLoading,
  onAssignRole,
  onAssignChairman
}) => {
  const [selectionByRole, setSelectionByRole] = useState<Record<string, string>>({});
  const [searchByRole, setSearchByRole] = useState<Record<string, string>>({});
  const [replacementRoleByUser, setReplacementRoleByUser] = useState<Record<string, string>>({});
  const [chairmanSearchQuery, setChairmanSearchQuery] = useState('');
  const [selectedChairmanUserId, setSelectedChairmanUserId] = useState('');
  const [committeeRoles, setCommitteeRoles] = useState<PlanningCommitteeRoleDefinition[]>([]);
  const [chairmanAssignment, setChairmanAssignment] = useState<PlanningCommitteeChairmanAssignment | null>(null);
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
          setRolesError(err instanceof Error ? err.message : 'Unable to load committee role definitions from the API.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setRolesLoading(false);
        }
      });

    fetchPlanningCommitteeChairmanAssignment(token)
      .then((data) => {
        if (isMounted) {
          setChairmanAssignment(data);
          setSelectedChairmanUserId(data.InternalUserId ?? '');
        }
      })
      .catch(() => {
        if (isMounted) {
          setChairmanAssignment(null);
          setSelectedChairmanUserId('');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const getUserRoleKey = React.useCallback(
    (user: InternalUserProfile) => resolveCanonicalRole(user.CanonicalRoleKey, user.RoleName),
    []
  );

  const fallbackCommitteeRoles = useMemo(() => {
    const allowed = new Set([
      'comptroller_procurement',
      'procurement_officer',
      'planning_officer',
      'compliance_officer'
    ]);

    const mapped: PlanningCommitteeRoleDefinition[] = [];
    for (const role of roles) {
      const roleKey = resolveCanonicalRole(role.CanonicalRoleKey, role.RoleName);
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

  const fallbackEvaluationRoles = useMemo(() => {
    const allowed = new Set([
      'evaluator'
    ]);

    const mapped: PlanningCommitteeRoleDefinition[] = [];
    for (const role of roles) {
      const roleKey = resolveCanonicalRole(role.CanonicalRoleKey, role.RoleName);
      if (!roleKey || !allowed.has(roleKey)) {
        continue;
      }

      if (mapped.some((entry) => entry.RoleKey === roleKey)) {
        continue;
      }

      mapped.push({
        RoleKey: roleKey,
        RoleName: role.RoleName,
        DisplayName: role.RoleName.replace(/_/g, ' '),
        Description: role.Description ?? '',
        IsChair: false
      });
    }

    return mapped;
  }, [roles]);

  const effectiveCommitteeRoles = (committeeRoles.length ? committeeRoles : fallbackCommitteeRoles)
    .filter((role) => !role.IsChair);
  const evaluationRoles = fallbackEvaluationRoles;
  const showRolesError = Boolean(rolesError) && effectiveCommitteeRoles.length === 0;
  const managedRoleNames = useMemo(
    () => new Set([...effectiveCommitteeRoles, ...evaluationRoles].map((role) => role.RoleName)),
    [effectiveCommitteeRoles, evaluationRoles]
  );

  const assignableUsers = useMemo(
    () => users.filter((user) => user.Status?.toLowerCase() !== 'inactive'),
    [users]
  );

  const filteredChairmanUsers = useMemo(() => {
    return filterUsers(assignableUsers, chairmanSearchQuery);
  }, [assignableUsers, chairmanSearchQuery]);

  const getFilteredRoleUsers = (roleKey: string) =>
    filterUsers(assignableUsers, searchByRole[roleKey] ?? '');

  function filterUsers(candidateUsers: InternalUserProfile[], queryValue: string) {
    const query = queryValue.trim().toLowerCase();
    if (!query) {
      return candidateUsers;
    }

    return candidateUsers.filter((user) => {
      const haystacks = [
        user.Email,
        user.Username,
        user.FirstName,
        user.MiddleName ?? '',
        user.Surname,
        user.RoleName,
        user.UnitName
      ];

      return haystacks.some((value) => value?.toLowerCase().includes(query));
    });
  }

  const removableToRoles = useMemo(
    () =>
      roles.filter((role) => role.IsActive && !managedRoleNames.has(role.RoleName)),
    [managedRoleNames, roles]
  );

  const renderRoleCards = (roleConfigs: PlanningCommitteeRoleDefinition[], heading: string, description: string) => (
    <>
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ marginBottom: '6px' }}>{heading}</h3>
        <p className="plan-muted" style={{ margin: 0 }}>{description}</p>
      </div>
      <div className="roles-grid" style={{ marginTop: '16px' }}>
        {roleConfigs.map((roleConfig) => {
          const members = users.filter((user) => getUserRoleKey(user) === roleConfig.RoleKey);
          const selectedUserId = selectionByRole[roleConfig.RoleKey] ?? '';
          const roleSearchQuery = searchByRole[roleConfig.RoleKey] ?? '';
          const filteredRoleUsers = getFilteredRoleUsers(roleConfig.RoleKey);

          return (
            <article key={roleConfig.RoleKey} className="portal-module-card" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                <h3 style={{ margin: 0 }}>{roleConfig.DisplayName}</h3>
                <span className={`admin-status ${members.length ? 'admin-status--good' : 'admin-status--warn'}`}>
                  {members.length} member{members.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="plan-muted" style={{ marginTop: '6px' }}>
                {roleConfig.Description || 'Role configured from API.'}
              </p>
              <p className="plan-muted" style={{ marginTop: '4px' }}>
                API role: <strong>{roleConfig.RoleName}</strong>
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
                                  <option key={role.RoleId} value={role.CanonicalRoleKey ?? role.RoleName}>
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
                                  if (!replacementRole) return;
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
                  <span>Search User</span>
                  <input
                    className="plan-input"
                    value={roleSearchQuery}
                    onChange={(event) =>
                      setSearchByRole((current) => ({
                        ...current,
                        [roleConfig.RoleKey]: event.target.value
                      }))
                    }
                    placeholder="Search by email, username, role, unit"
                    disabled={isLoading || rolesLoading}
                  />
                </label>
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
                    {filteredRoleUsers.map((user) => (
                      <option key={user.InternalUserId} value={user.InternalUserId}>
                        {user.Email} ({user.RoleName})
                      </option>
                    ))}
                  </select>
                  {roleSearchQuery.trim() ? (
                    <small className="plan-muted" style={{ marginTop: '6px', display: 'block' }}>
                      {filteredRoleUsers.length} match{filteredRoleUsers.length === 1 ? '' : 'es'} found
                    </small>
                  ) : null}
                </label>
                <div>
                  <button
                    type="button"
                    className="plan-button"
                    disabled={isLoading || rolesLoading || !selectedUserId}
                    onClick={() => selectedUserId && onAssignRole(selectedUserId, roleConfig.RoleKey)}
                  >
                    Assign Member
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
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
      <p className="plan-muted" style={{ marginTop: '6px' }}>
        Use the chairman card below to assign Planning Committee Chairman to any active user.
      </p>

      <article className="portal-module-card" style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
          <h3 style={{ margin: 0 }}>Planning Committee Chairman</h3>
          <span className={`admin-status ${chairmanAssignment?.InternalUserId ? 'admin-status--good' : 'admin-status--warn'}`}>
            {chairmanAssignment?.InternalUserId ? 'Assigned' : 'Unassigned'}
          </span>
        </div>
        <p className="plan-muted" style={{ marginTop: '6px' }}>
          This designation is separate from the user&apos;s main role and controls chairman-only planning committee actions.
        </p>
        <div style={{ marginTop: '10px' }}>
          {chairmanAssignment?.InternalUserId ? (
            <div className="plan-empty" style={{ textAlign: 'left' }}>
              <strong>{chairmanAssignment.Email || chairmanAssignment.Username || 'Assigned user'}</strong>
              {chairmanAssignment.RoleName ? ` (${chairmanAssignment.RoleName})` : ''}
              {chairmanAssignment.UnitName ? ` • ${chairmanAssignment.UnitName}` : ''}
            </div>
          ) : (
            <div className="plan-empty" style={{ textAlign: 'left' }}>
              No chairman assigned.
            </div>
          )}
        </div>
        <div className="plan-toolbar" style={{ marginTop: '12px' }}>
          <label className="plan-field">
            <span>Search Chairman</span>
            <input
              className="plan-input"
              value={chairmanSearchQuery}
              onChange={(event) => setChairmanSearchQuery(event.target.value)}
              placeholder="Search by email, username, role, unit"
              disabled={isLoading || rolesLoading}
            />
          </label>
          <label className="plan-field">
            <span>Select Chairman</span>
            <select
              className="plan-input"
              value={selectedChairmanUserId}
              onChange={(event) => setSelectedChairmanUserId(event.target.value)}
              disabled={isLoading || rolesLoading}
            >
              <option value="">Select user</option>
              {filteredChairmanUsers.map((user) => (
                <option key={user.InternalUserId} value={user.InternalUserId}>
                  {user.Email} ({user.RoleName})
                </option>
              ))}
            </select>
            {chairmanSearchQuery.trim() ? (
              <small className="plan-muted" style={{ marginTop: '6px', display: 'block' }}>
                {filteredChairmanUsers.length} match{filteredChairmanUsers.length === 1 ? '' : 'es'} found
              </small>
            ) : null}
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
            <button
              type="button"
              className="plan-button"
              disabled={isLoading || rolesLoading || !selectedChairmanUserId}
              onClick={async () => {
                await onAssignChairman(selectedChairmanUserId);
                if (token) {
                  const refreshed = await fetchPlanningCommitteeChairmanAssignment(token);
                  setChairmanAssignment(refreshed);
                }
              }}
            >
              Assign Chairman
            </button>
            <button
              type="button"
              className="plan-button plan-button--ghost"
              disabled={isLoading || rolesLoading || !chairmanAssignment?.InternalUserId}
              onClick={async () => {
                await onAssignChairman(null);
                setChairmanAssignment(null);
                setChairmanSearchQuery('');
                setSelectedChairmanUserId('');
              }}
            >
              Clear Chairman
            </button>
          </div>
        </div>
      </article>

      {renderRoleCards(
        effectiveCommitteeRoles,
        'Planning Committee Members',
        'Assign planning-side committee roles without editing records manually.'
      )}
      {renderRoleCards(
        evaluationRoles,
        'Evaluation Committee Members',
        'Assign the technical, financial, and consolidated evaluation roles used by the live evaluation workflow.'
      )}
      {showRolesError ? <div className="portal-alert">{rolesError}</div> : null}
      {!effectiveCommitteeRoles.length && !rolesLoading ? (
        <div className="plan-empty" style={{ textAlign: 'left' }}>
          No planning committee roles available.
        </div>
      ) : null}
    </article>
  );
};
