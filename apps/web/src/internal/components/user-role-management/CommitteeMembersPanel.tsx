'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { InternalRoleRecord, InternalUserProfile } from '../../types/internal';
import { ConfirmModal } from './ConfirmModal';
import {
  fetchPlanningCommitteeRoleDefinitions,
  fetchPlanningCommitteeChairmanAssignment,
  fetchCommitteeMembers,
  addCommitteeMember,
  removeCommitteeMember,
  type CommitteeMember,
  type PlanningCommitteeChairmanAssignment,
  type PlanningCommitteeRoleDefinition
} from '../../services/moduleService.planning';

interface CommitteeMembersPanelProps {
  roles: InternalRoleRecord[];
  users: InternalUserProfile[];
  token?: string | null;
  isLoading: boolean;
  onAssignChairman: (userId: string | null) => void | Promise<void>;
}

export const CommitteeMembersPanel: React.FC<CommitteeMembersPanelProps> = ({
  roles,
  users,
  token,
  isLoading,
  onAssignChairman
}) => {
  const [committeeRoles, setCommitteeRoles] = useState<PlanningCommitteeRoleDefinition[]>([]);
  const [chairmanAssignment, setChairmanAssignment] = useState<PlanningCommitteeChairmanAssignment | null>(null);
  const [planningMembers, setPlanningMembers] = useState<CommitteeMember[]>([]);
  const [evaluationMembers, setEvaluationMembers] = useState<CommitteeMember[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const [selectionByRole, setSelectionByRole] = useState<Record<string, string>>({});
  const [searchByRole, setSearchByRole] = useState<Record<string, string>>({});
  const [chairmanSearchQuery, setChairmanSearchQuery] = useState('');
  const [selectedChairmanUserId, setSelectedChairmanUserId] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<{ member: CommitteeMember; committeeType: string; roleConfig: PlanningCommitteeRoleDefinition } | null>(null);

  const loadMembers = useCallback(async () => {
    if (!token) return;
    try {
      const [planning, evaluation] = await Promise.all([
        fetchCommitteeMembers('planning', token),
        fetchCommitteeMembers('evaluation', token)
      ]);
      setPlanningMembers(planning);
      setEvaluationMembers(evaluation);
    } catch {
      // silent — members just stay empty
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setRolesLoading(true);
    setRolesError(null);

    fetchPlanningCommitteeRoleDefinitions(token)
      .then((data) => { if (isMounted) setCommitteeRoles(data); })
      .catch((err: unknown) => {
        if (isMounted) {
          setCommitteeRoles([]);
          setRolesError(err instanceof Error ? err.message : 'Unable to load committee roles.');
        }
      })
      .finally(() => { if (isMounted) setRolesLoading(false); });

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

    loadMembers();

    return () => { isMounted = false; };
  }, [token, loadMembers]);

  const assignableUsers = useMemo(
    () => users.filter((u) => u.Status?.toLowerCase() !== 'inactive'),
    [users]
  );

  const filteredChairmanUsers = useMemo(() => filterUsers(assignableUsers, chairmanSearchQuery), [assignableUsers, chairmanSearchQuery]);

  function filterUsers(candidates: InternalUserProfile[], q: string) {
    const query = q.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((u) =>
      [u.Email, u.Username, u.FirstName, u.MiddleName ?? '', u.Surname, u.RoleName, u.UnitName]
        .some((v) => v?.toLowerCase().includes(query))
    );
  }

  const effectiveCommitteeRoles = useMemo(() => {
    const nonChair = committeeRoles.filter((r) => !r.IsChair);
    if (nonChair.length) return nonChair;
    return roles.map((r) => ({
      RoleKey: r.CanonicalRoleKey ?? r.RoleName,
      RoleName: r.RoleName,
      DisplayName: r.RoleName,
      Description: r.Description ?? '',
      IsChair: false
    }));
  }, [committeeRoles, roles]);

  const handleAddMember = useCallback(async (committeeType: string, userId: string, roleKey: string) => {
    if (!token) return;
    await addCommitteeMember(committeeType, userId, roleKey, token);
    await loadMembers();
  }, [token, loadMembers]);

  const handleRemoveMember = useCallback(async (membershipId: string) => {
    if (!token) return;
    const type = planningMembers.some((m) => m.membership_id === membershipId) ? 'planning' : 'evaluation';
    await removeCommitteeMember(type, membershipId, token);
    await loadMembers();
  }, [token, planningMembers, loadMembers]);

  const renderRoleCards = (
    roleConfigs: PlanningCommitteeRoleDefinition[],
    members: CommitteeMember[],
    committeeType: string,
    heading: string,
    description: string
  ) => (
    <>
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ marginBottom: '6px' }}>{heading}</h3>
        <p className="plan-muted" style={{ margin: 0 }}>{description}</p>
      </div>
      <div className="roles-grid" style={{ marginTop: '16px' }}>
        {roleConfigs.map((roleConfig) => {
          const roleMembers = members.filter((m) => m.role_key === roleConfig.RoleKey);
          const selectedUserId = selectionByRole[`${committeeType}:${roleConfig.RoleKey}`] ?? '';
          const searchValue = searchByRole[`${committeeType}:${roleConfig.RoleKey}`] ?? '';
          const filtered = filterUsers(assignableUsers, searchValue);

          return (
            <article key={`${committeeType}:${roleConfig.RoleKey}`} className="portal-module-card" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                <h3 style={{ margin: 0 }}>{roleConfig.DisplayName}</h3>
                <span className={`admin-status ${roleMembers.length ? 'admin-status--good' : 'admin-status--warn'}`}>
                  {roleMembers.length} member{roleMembers.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="plan-muted" style={{ marginTop: '6px' }}>{roleConfig.Description || 'Role configured from API.'}</p>

              <div style={{ marginTop: '10px' }}>
                {roleMembers.length ? (
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {roleMembers.map((member) => (
                      <li key={member.membership_id} style={{ marginBottom: '10px' }}>
                        <div>
                          <strong>{member.email}</strong> ({member.username})
                          {member.unit_name ? ` \u2022 ${member.unit_name}` : ''}
                        </div>
                        <button
                          type="button"
                          className="plan-button plan-button--ghost plan-button--sm"
                          style={{ marginTop: '4px' }}
                          disabled={isLoading || rolesLoading}
                          onClick={() => setConfirmRemove({ member, committeeType, roleConfig })}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
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
                    value={searchValue}
                    onChange={(e) => setSearchByRole((c) => ({ ...c, [`${committeeType}:${roleConfig.RoleKey}`]: e.target.value }))}
                    placeholder="Search by email, username"
                    disabled={isLoading || rolesLoading}
                  />
                </label>
                <label className="plan-field">
                  <span>Select User</span>
                  <select
                    className="plan-input"
                    value={selectedUserId}
                    onChange={(e) => setSelectionByRole((c) => ({ ...c, [`${committeeType}:${roleConfig.RoleKey}`]: e.target.value }))}
                    disabled={isLoading || rolesLoading}
                  >
                    <option value="">Select user</option>
                    {filtered.map((u) => (
                      <option key={u.InternalUserId} value={u.InternalUserId}>
                        {u.Email} ({u.RoleName})
                      </option>
                    ))}
                  </select>
                  {searchValue.trim() ? (
                    <small className="plan-muted" style={{ marginTop: '6px', display: 'block' }}>
                      {filtered.length} match{filtered.length === 1 ? '' : 'es'}
                    </small>
                  ) : null}
                </label>
                <div>
                  <button
                    type="button"
                    className="plan-button"
                    disabled={isLoading || rolesLoading || !selectedUserId}
                    onClick={() => {
                      if (selectedUserId) {
                        void handleAddMember(committeeType, selectedUserId, roleConfig.RoleKey);
                        setSelectionByRole((c) => ({ ...c, [`${committeeType}:${roleConfig.RoleKey}`]: '' }));
                      }
                    }}
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
      <h3>Committee Members</h3>
      <p className="plan-muted">
        Committee membership is tracked separately from system roles. Users keep their main role while serving on committees.
      </p>

      {/* Chairman Card */}
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
              {chairmanAssignment.UnitName ? ` \u2022 ${chairmanAssignment.UnitName}` : ''}
            </div>
          ) : (
            <div className="plan-empty" style={{ textAlign: 'left' }}>No chairman assigned.</div>
          )}
        </div>
        <div className="plan-toolbar" style={{ marginTop: '12px' }}>
          <label className="plan-field">
            <span>Search Chairman</span>
            <input
              className="plan-input"
              value={chairmanSearchQuery}
              onChange={(e) => setChairmanSearchQuery(e.target.value)}
              placeholder="Search by email, username"
              disabled={isLoading || rolesLoading}
            />
          </label>
          <label className="plan-field">
            <span>Select Chairman</span>
            <select
              className="plan-input"
              value={selectedChairmanUserId}
              onChange={(e) => setSelectedChairmanUserId(e.target.value)}
              disabled={isLoading || rolesLoading}
            >
              <option value="">Select user</option>
              {filteredChairmanUsers.map((u) => (
                <option key={u.InternalUserId} value={u.InternalUserId}>
                  {u.Email} ({u.RoleName})
                </option>
              ))}
            </select>
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

      {renderRoleCards(effectiveCommitteeRoles, planningMembers, 'planning', 'Planning Committee Members', 'Assign planning-side committee roles. Members keep their system role.')}
      {renderRoleCards(effectiveCommitteeRoles, evaluationMembers, 'evaluation', 'Evaluation Committee Members', 'Assign evaluation committee roles used by the live evaluation workflow.')}

      {rolesError && <div className="portal-alert" style={{ marginTop: '12px' }}>{rolesError}</div>}

      <ConfirmModal
        isOpen={!!confirmRemove}
        title="Remove Committee Member"
        message={confirmRemove ? `Remove ${confirmRemove.member.email} from ${confirmRemove.roleConfig.DisplayName}?` : ''}
        confirmLabel="Remove"
        variant="warning"
        isLoading={isLoading}
        onConfirm={async () => {
          if (confirmRemove) {
            await handleRemoveMember(confirmRemove.member.membership_id);
          }
          setConfirmRemove(null);
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </article>
  );
};
