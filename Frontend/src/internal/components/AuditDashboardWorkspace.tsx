'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditCloseoutItem, AuditSummaryResponse, InternalModule } from '../types/internal';
import { fetchAuditCloseouts, fetchAuditSummary } from '../services/auditService';

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

const toTitle = (value?: string | null) =>
  value
    ? value
        .replace(/_/g, ' ')
        .split(' ')
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
        .join(' ')
    : 'Unspecified';

type Props = {
  module: InternalModule;
  token?: string | null;
};

export const AuditDashboardWorkspace = ({ module, token }: Props) => {
  const [summary, setSummary] = useState<AuditSummaryResponse | null>(null);
  const [closeouts, setCloseouts] = useState<AuditCloseoutItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!token) {
      setSummary(null);
      setCloseouts([]);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const [nextSummary, nextCloseouts] = await Promise.all([
        fetchAuditSummary(token),
        fetchAuditCloseouts(token, statusFilter || undefined)
      ]);
      setSummary(nextSummary);
      setCloseouts(nextCloseouts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load audit dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, statusFilter]);

  const latestCloseouts = useMemo(() => closeouts.slice(0, 8), [closeouts]);

  return (
    <section className="portal-module audit-dashboard">
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {error ? <div className="portal-alert">{error}</div> : null}

      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        <article className="portal-module-card">
          <h3>Active Workflow Items</h3>
          <p>{summary?.ActiveWorkflowItems ?? 0}</p>
        </article>
        <article className="portal-module-card">
          <h3>Open Reviews</h3>
          <p>{summary?.AdministrativeReviewsOpen ?? 0}</p>
        </article>
        <article className="portal-module-card">
          <h3>Archived Closeouts</h3>
          <p>{summary?.CloseoutsArchived ?? 0}</p>
        </article>
        <article className="portal-module-card">
          <h3>Recent Transitions</h3>
          <p>{summary?.RecentTransitions ?? 0} in the last 30 days</p>
        </article>
      </div>

      <div className="admin-grid" style={{ marginTop: '16px' }}>
        <article className="admin-card admin-card--wide">
          <div className="plan-toolbar" style={{ marginBottom: '12px' }}>
            <div className="plan-filters">
              <label className="plan-field">
                <span>Closeout Status</span>
                <select
                  className="plan-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Archived">Archived</option>
                  <option value="Reopened">Reopened</option>
                </select>
              </label>
              <div className="plan-actions">
                <button type="button" className="plan-button plan-button--secondary" onClick={() => void load()} disabled={!token || isLoading}>
                  {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>

          <h3>Closeout Register</h3>
          <table className="plan-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Record</th>
                <th>Status</th>
                <th>Archive Location</th>
                <th>Archived</th>
              </tr>
            </thead>
            <tbody>
              {latestCloseouts.map((closeout) => (
                <tr key={closeout.CloseoutId}>
                  <td>
                    <div>{closeout.CloseoutReference}</div>
                    <div className="plan-muted">{closeout.Summary}</div>
                  </td>
                  <td>{closeout.RecordTitle || `${toTitle(closeout.EntityType)} · ${closeout.EntityId}`}</td>
                  <td>{closeout.Status}</td>
                  <td>{closeout.ArchiveLocation || 'Not recorded'}</td>
                  <td>{formatDateTimeShort(closeout.ArchivedAt || closeout.CreatedAt)}</td>
                </tr>
              ))}
              {!latestCloseouts.length ? (
                <tr>
                  <td colSpan={5} className="plan-empty">
                    No closeouts match the selected filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </article>

        <article className="admin-card admin-card--wide">
          <h3>Recent Workflow Events</h3>
          <table className="plan-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Entity</th>
                <th>To Stage</th>
                <th>Status</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.RecentEvents ?? []).map((event) => (
                <tr key={event.HistoryId}>
                  <td>{formatDateTimeShort(event.CreatedAt)}</td>
                  <td>{toTitle(event.EntityType)} · {event.EntityId}</td>
                  <td>{event.ToStageTitle}</td>
                  <td>{event.StageStatus || 'Not recorded'}</td>
                  <td>{event.Actor || 'System'}</td>
                </tr>
              ))}
              {!summary?.RecentEvents?.length ? (
                <tr>
                  <td colSpan={5} className="plan-empty">
                    No recent workflow events were returned.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </article>
      </div>
    </section>
  );
};
