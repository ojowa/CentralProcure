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
    <section className="committee-section">
      <div className="committee-section__header">
        <h3 className="committee-section__title">{heading}</h3>
        <p className="committee-section__desc">{description}</p>
      </div>
      <div className="committee-section__grid">
        {roleConfigs.map((roleConfig) => {
          const roleMembers = members.filter((m) => m.role_key === roleConfig.RoleKey);
          const selectedUserId = selectionByRole[`${committeeType}:${roleConfig.RoleKey}`] ?? '';
          const searchValue = searchByRole[`${committeeType}:${roleConfig.RoleKey}`] ?? '';
          const filtered = filterUsers(assignableUsers, searchValue);

          return (
            <article key={`${committeeType}:${roleConfig.RoleKey}`} className="committee-role-card">
              <div className="committee-role-card__head">
                <h4 className="committee-role-card__name">{roleConfig.DisplayName}</h4>
                <span className={`committee-badge ${roleMembers.length ? 'committee-badge--assigned' : 'committee-badge--empty'}`}>
                  {roleMembers.length}
                </span>
              </div>
              {roleConfig.Description && (
                <p className="committee-role-card__desc">{roleConfig.Description}</p>
              )}

              <div className="committee-role-card__members">
                {roleMembers.length ? (
                  <ul className="committee-role-card__list">
                    {roleMembers.map((member) => (
                      <li key={member.membership_id} className="committee-role-card__member">
                        <div className="committee-role-card__member-info">
                          <strong>{member.email}</strong>
                          <span>{member.username}</span>
                          {member.unit_name && <span>{member.unit_name}</span>}
                        </div>
                        <button
                          type="button"
                          className="plan-button plan-button--ghost plan-button--sm"
                          disabled={isLoading || rolesLoading}
                          onClick={() => setConfirmRemove({ member, committeeType, roleConfig })}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="committee-role-card__empty">No members assigned</p>
                )}
              </div>

              <div className="committee-role-card__assign">
                <label className="plan-field">
                  <span>Search</span>
                  <input
                    className="plan-input"
                    value={searchValue}
                    onChange={(e) => setSearchByRole((c) => ({ ...c, [`${committeeType}:${roleConfig.RoleKey}`]: e.target.value }))}
                    placeholder="Email or username"
                    disabled={isLoading || rolesLoading}
                  />
                </label>
                <label className="plan-field">
                  <span>Select</span>
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
                    <small className="plan-muted">{filtered.length} match{filtered.length === 1 ? '' : 'es'}</small>
                  ) : null}
                </label>
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
                  Assign
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  return (
    <article className="committee-panel">
      <header className="committee-panel__header">
        <div className="committee-panel__header-text">
          <h3 className="committee-panel__title">Committee Members</h3>
          <p className="committee-panel__subtitle">
            Manage committee composition. Membership is separate from system roles.
          </p>
        </div>
      </header>

      {/* Chairman Card */}
      <section className="committee-chairman">
        <div className="committee-chairman__top">
          <div className="committee-chairman__label">
            <span className="committee-chairman__icon" aria-hidden="true">&#9733;</span>
            <div>
              <h4 className="committee-chairman__name">Planning Committee Chairman</h4>
              <p className="committee-chairman__hint">Designation separate from the user&apos;s main role</p>
            </div>
          </div>
          <span className={`committee-badge ${chairmanAssignment?.InternalUserId ? 'committee-badge--assigned' : 'committee-badge--empty'}`}>
            {chairmanAssignment?.InternalUserId ? 'Assigned' : 'Unassigned'}
          </span>
        </div>

        {chairmanAssignment?.InternalUserId ? (
          <div className="committee-chairman__current">
            <strong>{chairmanAssignment.Email || chairmanAssignment.Username}</strong>
            {chairmanAssignment.RoleName ? <span className="committee-chairman__meta"> {chairmanAssignment.RoleName}</span> : null}
            {chairmanAssignment.UnitName ? <span className="committee-chairman__meta"> &middot; {chairmanAssignment.UnitName}</span> : null}
          </div>
        ) : (
          <div className="committee-chairman__empty">No chairman assigned.</div>
        )}

        <div className="committee-chairman__form">
          <label className="plan-field committee-chairman__search">
            <span>Search</span>
            <input
              className="plan-input"
              value={chairmanSearchQuery}
              onChange={(e) => setChairmanSearchQuery(e.target.value)}
              placeholder="Email or username"
              disabled={isLoading || rolesLoading}
            />
          </label>
          <label className="plan-field committee-chairman__select">
            <span>Select</span>
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
          <div className="committee-chairman__actions">
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
              Assign
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
              Clear
            </button>
          </div>
        </div>
      </section>

      {renderRoleCards(effectiveCommitteeRoles, planningMembers, 'planning', 'Planning Committee', 'Assign planning-side committee roles.')}
      {renderRoleCards(effectiveCommitteeRoles, evaluationMembers, 'evaluation', 'Evaluation Committee', 'Assign evaluation roles for the live workflow.')}

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
