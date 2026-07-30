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
  const action = (event.Action || '').toLowerCase();
  return (
    action.includes('reject') ||
    action.includes('escalat') ||
    action.includes('delete') ||
    action.includes('cancel')
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
  const createCount = useMemo(() => history.filter((event) => (event.Action || '').toLowerCase() === 'create').length, [history]);
  const updateCount = useMemo(() => history.filter((event) => (event.Action || '').toLowerCase() === 'update').length, [history]);
  const deleteCount = useMemo(
    () =>
      history.filter((event) => {
        const action = (event.Action || '').toLowerCase();
        return action.includes('reject') || action.includes('delete');
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
          <h3>Total Audit Events</h3>
          <p>{history.length}</p>
        </article>
        <article className="portal-module-card">
          <h3>Create Actions</h3>
          <p>{createCount}</p>
        </article>
        <article className="portal-module-card">
          <h3>Rejections / Deletes</h3>
          <p>{deleteCount}</p>
        </article>
        <article className="portal-module-card">
          <h3>Updates</h3>
          <p>{updateCount}</p>
        </article>
      </div>

      {isLoading ? <p>Loading compliance signals...</p> : null}

      <div className="admin-card admin-card--full" style={{ marginTop: '16px' }}>
        <h3>Flagged Audit Events</h3>
        <div className="portal-table-container">
        <table className="plan-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Entity</th>
              <th>Action</th>
              <th>Performed By</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {flagged.length ? (
              flagged.map((event) => (
                <tr key={event.AuditId}>
                  <td>{formatDateTimeShort(event.CreatedAt)}</td>
                  <td>{event.EntityType} · {event.EntityId.slice(0, 8)}</td>
                  <td>{event.Action}</td>
                  <td>{event.PerformedBy || 'System'}</td>
                  <td>{event.Notes || '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="plan-empty">
                  No flagged audit events in the current dataset.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
};
