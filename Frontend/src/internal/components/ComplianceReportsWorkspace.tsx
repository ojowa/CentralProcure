'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditHistoryItem, AuditSummaryResponse, InternalModule } from '../types/internal';
import { fetchAuditHistory, fetchAuditSummary } from '../services/auditService';

const formatDateTimeShort = (value?: string | null) => {
  if (!value) {
    return 'Not recorded';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const isFlagged = (event: AuditHistoryItem) => {
  const status = (event.StageStatus || '').toLowerCase();
  return (
    status.includes('reject') ||
    status.includes('escalat') ||
    status.includes('hold') ||
    status.includes('terminat') ||
    event.ToStageKey === 'administrative_review'
  );
};

type Props = {
  module: InternalModule;
  token?: string | null;
};

export const ComplianceReportsWorkspace = ({ module, token }: Props) => {
  const [summary, setSummary] = useState<AuditSummaryResponse | null>(null);
  const [history, setHistory] = useState<AuditHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setSummary(null);
        setHistory([]);
        return;
      }

      setIsLoading(true);
      setError('');
      try {
        const [nextSummary, nextHistory] = await Promise.all([
          fetchAuditSummary(token),
          fetchAuditHistory(token, { limit: 250 })
        ]);
        setSummary(nextSummary);
        setHistory(nextHistory);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load compliance reports.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [token]);

  const flagged = useMemo(() => history.filter(isFlagged).slice(0, 20), [history]);
  const complaintBranches = useMemo(() => history.filter((event) => event.ToStageKey === 'administrative_review').length, [history]);
  const closeoutMoves = useMemo(() => history.filter((event) => event.ToStageKey === 'closeout_and_audit').length, [history]);
  const escalations = useMemo(
    () =>
      history.filter((event) => {
        const status = (event.StageStatus || '').toLowerCase();
        return status.includes('escalat') || event.ToStageKey === 'bpp_no_objection';
      }).length,
    [history]
  );

  return (
    <section className="portal-module compliance-reports">
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {error ? <div className="portal-alert">{error}</div> : null}

      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        <article className="portal-module-card">
          <h3>Recent Transitions</h3>
          <p>{summary?.RecentTransitions ?? 0}</p>
        </article>
        <article className="portal-module-card">
          <h3>Complaint Branches</h3>
          <p>{complaintBranches}</p>
        </article>
        <article className="portal-module-card">
          <h3>Escalations / BPP</h3>
          <p>{escalations}</p>
        </article>
        <article className="portal-module-card">
          <h3>Closeout Movements</h3>
          <p>{closeoutMoves}</p>
        </article>
      </div>

      {isLoading ? <p>Loading compliance signals...</p> : null}

      <div className="admin-card admin-card--full" style={{ marginTop: '16px' }}>
        <h3>Flagged Workflow Events</h3>
        <table className="plan-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Entity</th>
              <th>To Stage</th>
              <th>Status</th>
              <th>Source</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {flagged.length ? (
              flagged.map((event) => (
                <tr key={event.HistoryId}>
                  <td>{formatDateTimeShort(event.CreatedAt)}</td>
                  <td>{event.RecordTitle || `${event.EntityType} · ${event.EntityId}`}</td>
                  <td>{event.ToStageTitle}</td>
                  <td>{event.StageStatus || 'No status'}</td>
                  <td>{event.TransitionSource}</td>
                  <td>{event.TransitionReason || 'No reason recorded'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="plan-empty">
                  No flagged workflow events in the current dataset.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
