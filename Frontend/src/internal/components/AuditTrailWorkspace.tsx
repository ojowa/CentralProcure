'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditHistoryItem, AuditWorkflowDiagnosticsResponse, InternalModule } from '../types/internal';
import { fetchAuditHistory, fetchAuditWorkflowDiagnostics } from '../services/auditService';

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

export const AuditTrailWorkspace = ({ module, token }: Props) => {
  const [filters, setFilters] = useState({
    entityType: '',
    actor: '',
    transitionSource: '',
    query: '',
    dateFrom: '',
    dateTo: ''
  });
  const [events, setEvents] = useState<AuditHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState<AuditWorkflowDiagnosticsResponse | null>(null);
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState('');

  const load = async () => {
    if (!token) {
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const next = await fetchAuditHistory(token, {
        entityType: filters.entityType || undefined,
        actor: filters.actor || undefined,
        transitionSource: filters.transitionSource || undefined,
        query: filters.query || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        limit: 250
      });
      setEvents(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load audit history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, filters.entityType, filters.actor, filters.transitionSource, filters.query, filters.dateFrom, filters.dateTo]);

  const handleExport = () => {
    const headers = ['Timestamp', 'Entity Type', 'Entity ID', 'From Stage', 'To Stage', 'Status', 'Source', 'Actor', 'Reason'];
    const rows = events.map((event) => [
      formatDateTimeShort(event.CreatedAt),
      event.EntityType,
      event.EntityId,
      event.FromStageTitle || event.FromStageKey || '',
      event.ToStageTitle,
      event.StageStatus || '',
      event.TransitionSource,
      event.Actor || '',
      event.TransitionReason || ''
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `workflow-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const openDiagnostics = async (event: AuditHistoryItem) => {
    if (!token) {
      return;
    }

    setDiagnostics(null);
    setDiagnosticsError('');
    setIsDiagnosticsLoading(true);
    try {
      const next = await fetchAuditWorkflowDiagnostics(token, event.EntityType, event.EntityId);
      setDiagnostics(next);
    } catch (loadError) {
      setDiagnosticsError(loadError instanceof Error ? loadError.message : 'Unable to load diagnostics.');
    } finally {
      setIsDiagnosticsLoading(false);
    }
  };

  const transitionSources = useMemo(
    () => Array.from(new Set(events.map((event) => event.TransitionSource))).sort((a, b) => a.localeCompare(b)),
    [events]
  );

  return (
    <section className="portal-module audit-trail">
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {error ? <div className="portal-alert">{error}</div> : null}

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Entity Type</span>
            <input
              className="plan-input"
              value={filters.entityType}
              onChange={(event) => setFilters((previous) => ({ ...previous, entityType: event.target.value }))}
              placeholder="contract, tender, requisition"
            />
          </label>
          <label className="plan-field">
            <span>Actor</span>
            <input
              className="plan-input"
              value={filters.actor}
              onChange={(event) => setFilters((previous) => ({ ...previous, actor: event.target.value }))}
              placeholder="Email or username"
            />
          </label>
          <label className="plan-field">
            <span>Source</span>
            <select
              className="plan-select"
              value={filters.transitionSource}
              onChange={(event) => setFilters((previous) => ({ ...previous, transitionSource: event.target.value }))}
            >
              <option value="">All sources</option>
              {transitionSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((previous) => ({ ...previous, query: event.target.value }))}
              placeholder="Record title, reason, stage"
            />
          </label>
          <label className="plan-field">
            <span>Date From</span>
            <input
              className="plan-input"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((previous) => ({ ...previous, dateFrom: event.target.value }))}
            />
          </label>
          <label className="plan-field">
            <span>Date To</span>
            <input
              className="plan-input"
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((previous) => ({ ...previous, dateTo: event.target.value }))}
            />
          </label>
          <div className="plan-actions">
            <button type="button" className="plan-button plan-button--secondary" onClick={handleExport}>
              Export CSV
            </button>
            <button type="button" className="plan-button" onClick={() => void load()} disabled={!token || isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <table className="plan-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Entity</th>
            <th>From</th>
            <th>To</th>
            <th>Status</th>
            <th>Source</th>
            <th>Actor</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.HistoryId}>
              <td>{formatDateTimeShort(event.CreatedAt)}</td>
              <td>
                <div>{event.RecordTitle || `${toTitle(event.EntityType)} · ${event.EntityId}`}</div>
                <div className="plan-muted">{toTitle(event.EntityType)}</div>
              </td>
              <td>{event.FromStageTitle || event.FromStageKey || 'Start'}</td>
              <td>
                <div>{event.ToStageTitle}</div>
                <div className="plan-muted">{event.TransitionReason || 'No reason recorded'}</div>
              </td>
              <td>{event.StageStatus || 'No status'}</td>
              <td>{event.TransitionSource}</td>
              <td>{event.Actor || 'System'}</td>
              <td>
                <button type="button" className="plan-link" onClick={() => void openDiagnostics(event)}>
                  Diagnose
                </button>
              </td>
            </tr>
          ))}
          {!events.length && !isLoading ? (
            <tr>
              <td colSpan={8} className="plan-empty">
                No workflow history matches the selected filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {(isDiagnosticsLoading || diagnostics || diagnosticsError) ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div
            className="plan-modal__backdrop"
            onClick={() => {
              setDiagnostics(null);
              setDiagnosticsError('');
              setIsDiagnosticsLoading(false);
            }}
          />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>Workflow Diagnostics</h3>
                <p>{diagnostics?.Runtime.RecordTitle || diagnostics?.Runtime.EntityId || 'Loading diagnostics.'}</p>
              </div>
              <button
                type="button"
                className="plan-link"
                onClick={() => {
                  setDiagnostics(null);
                  setDiagnosticsError('');
                  setIsDiagnosticsLoading(false);
                }}
              >
                Close
              </button>
            </div>
            {isDiagnosticsLoading ? <div className="plan-loading">Loading diagnostics...</div> : null}
            {diagnosticsError ? <div className="portal-alert">{diagnosticsError}</div> : null}
            {diagnostics ? (
              <>
                <div className="requisition-detail-grid">
                  <div className="requisition-card">
                    <h4>Current Stage</h4>
                    <p>{diagnostics.Runtime.CurrentStageTitle}</p>
                    <p className="plan-muted">{diagnostics.Runtime.CurrentStatus || 'No live status'}</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Approval Route</h4>
                    <p>{diagnostics.RouteDecision?.ApprovalRoute || 'Not resolved'}</p>
                    <p className="plan-muted">
                      Board: {diagnostics.RouteDecision?.RequiresBoard ? 'Yes' : 'No'} · BPP: {diagnostics.RouteDecision?.RequiresBpp ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="requisition-card">
                    <h4>Role Context</h4>
                    <p>{diagnostics.RoleKey || 'No role snapshot'}</p>
                    <p className="plan-muted">{diagnostics.GrantedActions.length} granted action(s)</p>
                  </div>
                  <div className="requisition-card">
                    <h4>Last Transition Reason</h4>
                    <p>{diagnostics.Runtime.LastTransitionReason || 'No transition reason recorded'}</p>
                    <p className="plan-muted">Updated {formatDateTimeShort(diagnostics.Runtime.UpdatedAt)}</p>
                  </div>
                </div>

                <div className="requisition-detail-note">
                  <h4>Granted Actions</h4>
                  <p>
                    {diagnostics.GrantedActions.length
                      ? diagnostics.GrantedActions.map((action) => action.ActionKey).join(', ')
                      : 'No workflow actions are currently granted for this entity and role.'}
                  </p>
                </div>

                <div className="admin-card admin-card--full" style={{ marginTop: '16px' }}>
                  <h4>Transition Checks</h4>
                  <table className="plan-table">
                    <thead>
                      <tr>
                        <th>Target Stage</th>
                        <th>Condition</th>
                        <th>Allowed</th>
                        <th>Diagnostic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.TransitionChecks.map((check) => (
                        <tr key={check.RequestedStageKey}>
                          <td>{check.RequestedStageTitle}</td>
                          <td>{check.TransitionCondition}</td>
                          <td>{check.IsAllowed ? 'Yes' : 'No'}</td>
                          <td>{check.Message || 'Allowed by current policy.'}</td>
                        </tr>
                      ))}
                      {!diagnostics.TransitionChecks.length ? (
                        <tr>
                          <td colSpan={4} className="plan-empty">
                            No downstream transitions are defined from the current stage.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="admin-card admin-card--full" style={{ marginTop: '16px' }}>
                  <h4>Recent Entity History</h4>
                  <table className="plan-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Status</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.RecentHistory.map((entry) => (
                        <tr key={entry.HistoryId}>
                          <td>{formatDateTimeShort(entry.CreatedAt)}</td>
                          <td>{entry.FromStageKey || 'Start'}</td>
                          <td>{entry.ToStageTitle}</td>
                          <td>{entry.StageStatus || 'No status'}</td>
                          <td>{entry.TransitionSource}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
