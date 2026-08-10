'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { InternalUserProfile, TenderEvaluationAssignmentItem, TenderEvaluationAssignmentRole } from '../../types/internal';
import {
  fetchTenderEvaluationAssignments,
  updateTenderEvaluationAssignment
} from '../../services/evaluationAssignmentService';

interface EvaluationCommitteeAssignmentsPanelProps {
  token?: string | null;
  users: InternalUserProfile[];
  isLoading: boolean;
}

const roleLabels: Record<TenderEvaluationAssignmentRole, string> = {
  technical_evaluator: 'Technical Evaluator',
  financial_evaluator: 'Financial Evaluator',
  evaluation_committee: 'Evaluation Committee Lead'
};

const roleOrder: TenderEvaluationAssignmentRole[] = [
  'technical_evaluator',
  'financial_evaluator',
  'evaluation_committee'
];

export const EvaluationCommitteeAssignmentsPanel: React.FC<EvaluationCommitteeAssignmentsPanelProps> = ({
  token,
  users,
  isLoading
}) => {
  const [items, setItems] = useState<TenderEvaluationAssignmentItem[]>([]);
  const [query, setQuery] = useState('');
  const [searchBySlot, setSearchBySlot] = useState<Record<string, string>>({});
  const [selectionBySlot, setSelectionBySlot] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const assignableUsers = useMemo(
    () => users.filter((user) => user.Status?.toLowerCase() !== 'inactive'),
    [users]
  );

  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }

    let isMounted = true;
    setError(null);
    fetchTenderEvaluationAssignments(token)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setItems(Array.isArray(data) ? data : []);
        setSelectionBySlot((current) => {
          const next = { ...current };
          for (const item of data) {
            next[`${item.TenderId}:${item.AssignmentRole}`] = item.InternalUserId ?? '';
          }
          return next;
        });
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load tender assignments.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const tenders = useMemo(() => {
    const grouped = new Map<string, {
      tenderId: string;
      tenderTitle: string;
      tenderStatus: string;
      assignments: Partial<Record<TenderEvaluationAssignmentRole, TenderEvaluationAssignmentItem>>;
    }>();

    for (const item of items) {
      const current = grouped.get(item.TenderId) ?? {
        tenderId: item.TenderId,
        tenderTitle: item.TenderTitle,
        tenderStatus: item.TenderStatus,
        assignments: {}
      };
      current.assignments[item.AssignmentRole] = item;
      grouped.set(item.TenderId, current);
    }

    return Array.from(grouped.values()).filter((entry) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) {
        return true;
      }

      return (
        entry.tenderTitle.toLowerCase().includes(normalized) ||
        entry.tenderStatus.toLowerCase().includes(normalized)
      );
    });
  }, [items, query]);

  const filterUsers = (searchValue: string) => {
    const normalized = searchValue.trim().toLowerCase();
    if (!normalized) {
      return assignableUsers;
    }

    return assignableUsers.filter((user) =>
      [
        user.Email,
        user.Username,
        user.FirstName,
        user.MiddleName ?? '',
        user.Surname,
        user.RoleName,
        user.UnitName
      ].some((value) => value?.toLowerCase().includes(normalized))
    );
  };

  const handleAssign = async (tenderId: string, role: TenderEvaluationAssignmentRole, internalUserId: string | null) => {
    if (!token) {
      setError('Authentication is required to manage evaluation assignments.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    // Optimistic update
    const slotKey = `${tenderId}:${role}`;
    const previousSelection = selectionBySlot[slotKey];
    setSelectionBySlot(current => ({ ...current, [slotKey]: internalUserId ?? '' }));
    setItems(current => current.map(item =>
      item.TenderId === tenderId && item.AssignmentRole === role
        ? { ...item, InternalUserId: internalUserId ?? undefined }
        : item
    ));

    try {
      await updateTenderEvaluationAssignment(token, tenderId, {
        AssignmentRole: role,
        InternalUserId: internalUserId
      });
      setSuccess(internalUserId ? 'Tender evaluation assignment updated.' : 'Tender evaluation assignment cleared.');
    } catch (err) {
      // Revert on failure
      setSelectionBySlot(current => ({ ...current, [slotKey]: previousSelection ?? '' }));
      setItems(current => current.map(item =>
        item.TenderId === tenderId && item.AssignmentRole === role
          ? { ...item, InternalUserId: previousSelection || undefined }
          : item
      ));
      setError(err instanceof Error ? err.message : 'Failed to update tender evaluation assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="portal-module-card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
        <div>
          <h3 style={{ margin: 0 }}>Tender Evaluation Assignments</h3>
          <p className="plan-muted" style={{ margin: '6px 0 0' }}>
            Assign evaluators per tender so only the selected officers see that evaluation workload.
          </p>
        </div>
        <span className="admin-tag">{tenders.length} tenders</span>
      </div>

      <div className="plan-toolbar" style={{ marginTop: '12px' }}>
        <label className="plan-field">
          <span>Search Tender</span>
          <input
            className="plan-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or status"
            disabled={isLoading || isSubmitting}
          />
        </label>
      </div>

      {error ? <div className="portal-alert" style={{ marginTop: '12px' }}>{error}</div> : null}
      {success ? <div className="plan-success" style={{ marginTop: '12px' }}>{success}</div> : null}

      <div style={{ marginTop: '16px', display: 'grid', gap: '16px' }}>
        {tenders.map((tender) => (
          <article key={tender.tenderId} className="portal-module-card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
              <h3 style={{ margin: 0 }}>{tender.tenderTitle}</h3>
              <span className={`admin-status ${tender.tenderStatus.toLowerCase().includes('active') || tender.tenderStatus.toLowerCase().includes('open') ? 'admin-status--good' : tender.tenderStatus.toLowerCase().includes('closed') || tender.tenderStatus.toLowerCase().includes('awarded') ? 'admin-status--info' : 'admin-status--warn'}`}>{tender.tenderStatus}</span>
            </div>

            <div style={{ marginTop: '12px', display: 'grid', gap: '12px' }}>
              {roleOrder.map((role) => {
                const item = tender.assignments[role];
                const slotKey = `${tender.tenderId}:${role}`;
                const selectedUserId = selectionBySlot[slotKey] ?? item?.InternalUserId ?? '';
                const searchValue = searchBySlot[slotKey] ?? '';
                const filteredUsers = filterUsers(searchValue);

                return (
                  <div key={slotKey} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.25)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                      <strong>{roleLabels[role]}</strong>
                      <span className={`admin-status ${item?.InternalUserId ? 'admin-status--good' : 'admin-status--warn'}`}>
                        {item?.InternalUserId ? 'Assigned' : 'Unassigned'}
                      </span>
                    </div>

                    <p className="plan-muted" style={{ margin: '6px 0 0' }}>
                      {item?.Email
                        ? `${item.Email}${item.RoleName ? ` (${item.RoleName})` : ''}${item.UnitName ? ` • ${item.UnitName}` : ''}`
                        : 'No user assigned to this tender role yet.'}
                    </p>

                    <div className="plan-toolbar" style={{ marginTop: '10px' }}>
                      <label className="plan-field">
                        <span>Search User</span>
                        <input
                          className="plan-input"
                          value={searchValue}
                          onChange={(event) =>
                            setSearchBySlot((current) => ({
                              ...current,
                              [slotKey]: event.target.value
                            }))
                          }
                          placeholder="Search by email, username, role, unit"
                          disabled={isLoading || isSubmitting}
                        />
                      </label>
                      <label className="plan-field">
                        <span>Select User</span>
                        <select
                          className="plan-input"
                          value={selectedUserId}
                          onChange={(event) =>
                            setSelectionBySlot((current) => ({
                              ...current,
                              [slotKey]: event.target.value
                            }))
                          }
                          disabled={isLoading || isSubmitting}
                        >
                          <option value="">Select user</option>
                          {filteredUsers.map((user) => (
                            <option key={user.InternalUserId} value={user.InternalUserId}>
                              {user.Email} ({user.RoleName})
                            </option>
                          ))}
                        </select>
                        {searchValue.trim() ? (
                          <small className="plan-muted" style={{ marginTop: '6px', display: 'block' }}>
                            {filteredUsers.length} match{filteredUsers.length === 1 ? '' : 'es'} found
                          </small>
                        ) : null}
                      </label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
                        <button
                          type="button"
                          className="plan-button"
                          disabled={isLoading || isSubmitting || !selectedUserId}
                          onClick={() => void handleAssign(tender.tenderId, role, selectedUserId)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="plan-button plan-button--ghost"
                          disabled={isLoading || isSubmitting || !item?.InternalUserId}
                          onClick={() => void handleAssign(tender.tenderId, role, null)}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      {!tenders.length && !error ? (
        <div className="plan-empty" style={{ marginTop: '16px', textAlign: 'left' }}>
          No tenders available for evaluation assignment.
        </div>
      ) : null}
    </article>
  );
};
