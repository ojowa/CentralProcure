'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataGrid, SelectColumn, type Column, type SortColumn } from 'react-data-grid';
import type { AuditHistoryItem, AuditWorkflowDiagnosticsResponse, InternalModule } from '../types/internal';
import { fetchAuditHistoryPage, fetchAuditWorkflowDiagnostics } from '../services/auditService';

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

const statusTone = (value?: string | null) => {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('reject') || normalized.includes('hold') || normalized.includes('cancel')) {
    return 'admin-status admin-status--alert';
  }
  if (normalized.includes('escalat') || normalized.includes('review')) {
    return 'admin-status admin-status--warn';
  }
  return 'admin-status admin-status--good';
};

const sourceTone = (value: string) => {
  switch (value.toLowerCase()) {
    case 'manual':
      return 'admin-status admin-status--warn';
    case 'system':
    case 'scheduler':
      return 'admin-status admin-status--good';
    default:
      return 'admin-status';
  }
};

type AuditGridRow = {
  id: string;
  createdAt: string;
  recordTitle: string;
  entityType: string;
  entityId: string;
  fromStageTitle: string;
  toStageTitle: string;
  currentStageTitle: string;
  stageStatus: string;
  transitionSource: string;
  actor: string;
  transitionReason: string;
  raw: AuditHistoryItem;
};

type Props = {
  module: InternalModule;
  token?: string | null;
};

export const AuditTrailWorkspace = ({ module, token }: Props) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([{ columnKey: 'createdAt', direction: 'DESC' }]);
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(new Set());
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

  const activeSort = sortColumns[0];

  const load = async () => {
    if (!token) {
      setEvents([]);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const next = await fetchAuditHistoryPage(token, {
        entityType: filters.entityType || undefined,
        actor: filters.actor || undefined,
        transitionSource: filters.transitionSource || undefined,
        query: filters.query || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page,
        pageSize,
        sortBy: activeSort?.columnKey,
        sortDir: activeSort?.direction.toLowerCase() as 'asc' | 'desc' | undefined
      });
      setEvents(next.Items);
      setTotal(next.Total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load audit history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [
    token,
    filters.entityType,
    filters.actor,
    filters.transitionSource,
    filters.query,
    filters.dateFrom,
    filters.dateTo,
    page,
    pageSize,
    activeSort?.columnKey,
    activeSort?.direction
  ]);

  useEffect(() => {
    setSelectedRows(new Set());
  }, [events]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

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

  const closeDiagnostics = () => {
    setDiagnostics(null);
    setDiagnosticsError('');
    setIsDiagnosticsLoading(false);
  };

  const transitionSources = useMemo(
    () => Array.from(new Set(events.map((event) => event.TransitionSource))).sort((a, b) => a.localeCompare(b)),
    [events]
  );

  const gridRows = useMemo<AuditGridRow[]>(
    () =>
      events.map((event) => ({
        id: event.HistoryId,
        createdAt: formatDateTimeShort(event.CreatedAt),
        recordTitle: event.RecordTitle || `${toTitle(event.EntityType)} · ${event.EntityId}`,
        entityType: toTitle(event.EntityType),
        entityId: event.EntityId,
        fromStageTitle: event.FromStageTitle || event.FromStageKey || 'Start',
        toStageTitle: event.ToStageTitle,
        currentStageTitle: event.CurrentStageTitle || event.CurrentStageKey || 'Not resolved',
        stageStatus: event.StageStatus || 'No status',
        transitionSource: toTitle(event.TransitionSource),
        actor: event.Actor || 'System',
        transitionReason: event.TransitionReason || 'No transition reason recorded',
        raw: event
      })),
    [events]
  );

  const selectedCount = selectedRows.size;
  const selectedRow = selectedCount ? gridRows.find((row) => selectedRows.has(row.id)) ?? null : null;
  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
  const uniqueEntities = useMemo(() => new Set(events.map((event) => `${event.EntityType}:${event.EntityId}`)).size, [events]);
  const escalatedEvents = useMemo(
    () =>
      events.filter((event) => {
        const status = (event.StageStatus || '').toLowerCase();
        return status.includes('escalat') || event.ToStageKey === 'administrative_review' || event.ToStageKey === 'bpp_no_objection';
      }).length,
    [events]
  );
  const systemEvents = useMemo(() => events.filter((event) => !event.Actor || event.Actor === 'System').length, [events]);

  const columns: readonly Column<AuditGridRow>[] = useMemo(
    () => [
      SelectColumn,
      {
        key: 'createdAt',
        name: 'Timestamp',
        frozen: true,
        sortable: true,
        resizable: true,
        width: 170
      },
      {
        key: 'recordTitle',
        name: 'Record',
        sortable: true,
        resizable: true,
        minWidth: 260,
        renderCell: ({ row }) => (
          <div className="audit-trail__grid-record">
            <strong>{row.recordTitle}</strong>
            <span>{row.entityType}</span>
          </div>
        )
      },
      {
        key: 'fromStageTitle',
        name: 'From Stage',
        sortable: true,
        resizable: true,
        minWidth: 150
      },
      {
        key: 'toStageTitle',
        name: 'To Stage',
        sortable: true,
        resizable: true,
        minWidth: 170
      },
      {
        key: 'currentStageTitle',
        name: 'Current Live Stage',
        resizable: true,
        minWidth: 170
      },
      {
        key: 'stageStatus',
        name: 'Status',
        sortable: true,
        resizable: true,
        minWidth: 140,
        renderCell: ({ row }) => <span className={statusTone(row.stageStatus)}>{row.stageStatus}</span>
      },
      {
        key: 'transitionSource',
        name: 'Source',
        sortable: true,
        resizable: true,
        minWidth: 130,
        renderCell: ({ row }) => <span className={sourceTone(row.raw.TransitionSource)}>{row.transitionSource}</span>
      },
      {
        key: 'actor',
        name: 'Actor',
        sortable: true,
        resizable: true,
        minWidth: 180
      },
      {
        key: 'transitionReason',
        name: 'Reason',
        resizable: true,
        minWidth: 280
      },
      {
        key: 'actions',
        name: 'Diagnostics',
        resizable: false,
        sortable: false,
        width: 120,
        renderCell: () => <span className="audit-trail__grid-action">Open</span>
      }
    ],
    []
  );

  return (
    <section className="portal-module audit-trail">
      <div className="audit-trail__hero">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className="audit-trail__hero-meta">
          <span className="admin-status">Immutable workflow evidence</span>
          <span className="plan-muted">
            Showing {pageStart}-{pageEnd} of {total}
          </span>
        </div>
      </div>

      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {error ? <div className="portal-alert">{error}</div> : null}

      <div className="audit-trail__metrics">
        <div className="audit-trail__metric">
          <span>Events In View</span>
          <strong>{events.length}</strong>
        </div>
        <div className="audit-trail__metric">
          <span>Filtered Total</span>
          <strong>{total}</strong>
        </div>
        <div className="audit-trail__metric">
          <span>Unique Records</span>
          <strong>{uniqueEntities}</strong>
        </div>
        <div className="audit-trail__metric">
          <span>Escalations / Complaints</span>
          <strong>{escalatedEvents}</strong>
        </div>
      </div>

      <div className="plan-toolbar audit-trail__toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Entity Type</span>
            <input
              className="plan-input"
              value={filters.entityType}
              onChange={(event) => updateFilter('entityType', event.target.value)}
              placeholder="contract, tender, requisition"
            />
          </label>
          <label className="plan-field">
            <span>Actor</span>
            <input
              className="plan-input"
              value={filters.actor}
              onChange={(event) => updateFilter('actor', event.target.value)}
              placeholder="Email or username"
            />
          </label>
          <label className="plan-field">
            <span>Source</span>
            <select
              className="plan-select"
              value={filters.transitionSource}
              onChange={(event) => updateFilter('transitionSource', event.target.value)}
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
              onChange={(event) => updateFilter('query', event.target.value)}
              placeholder="Record title, reason, stage"
            />
          </label>
          <label className="plan-field">
            <span>Date From</span>
            <input
              className="plan-input"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>Date To</span>
            <input
              className="plan-input"
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>Page Size</span>
            <select
              className="plan-select"
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value));
              }}
            >
              <option value={12}>12 rows</option>
              <option value={24}>24 rows</option>
              <option value={48}>48 rows</option>
            </select>
          </label>
          <div className="plan-actions">
            <button type="button" className="plan-button plan-button--secondary" onClick={handleExport}>
              Export CSV
            </button>
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={() => {
                setPage(1);
                setFilters({
                  entityType: '',
                  actor: '',
                  transitionSource: '',
                  query: '',
                  dateFrom: '',
                  dateTo: ''
                });
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="plan-button"
              onClick={() => {
                if (selectedRow) {
                  void openDiagnostics(selectedRow.raw);
                }
              }}
              disabled={!selectedRow || isLoading}
            >
              Diagnose Selected
            </button>
          </div>
        </div>
      </div>

      <div className="audit-trail__surface">
        <div className="audit-trail__surface-header">
          <div>
            <h3>Audit Grid</h3>
            <p>Sortable, resizable, virtualized workflow history with row selection and direct diagnostics access.</p>
          </div>
          <div className="audit-trail__surface-meta">
            <span className="plan-muted">System events: {systemEvents}</span>
            <span className="plan-muted">Selected rows: {selectedCount}</span>
          </div>
        </div>

        <div className="audit-trail__grid-shell">
          {gridRows.length ? (
            <DataGrid
              className="audit-trail__grid rdg-light"
              style={{ height: 'min(70vh, 720px)' }}
              columns={columns}
              rows={gridRows}
              rowKeyGetter={(row) => row.id}
              selectedRows={selectedRows}
              onSelectedRowsChange={setSelectedRows}
              sortColumns={sortColumns}
              onSortColumnsChange={(nextSortColumns) => {
                setPage(1);
                setSortColumns(nextSortColumns.slice(-1));
              }}
              defaultColumnOptions={{
                sortable: true,
                resizable: true
              }}
              rowHeight={40}
              headerRowHeight={42}
              onCellClick={({ column, row }, event) => {
                if (column.key === 'actions') {
                  event.preventGridDefault();
                  void openDiagnostics(row.raw);
                }
              }}
            />
          ) : (
            <div className="plan-empty">No workflow history matches the selected filters.</div>
          )}
        </div>

        <div className="plan-pagination">
          <span className="plan-pagination__meta">
            Showing {pageStart}-{pageEnd} of {total}
          </span>
          <div className="plan-pagination__controls">
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={() => setPage(Math.max(page - 1, 1))}
              disabled={page <= 1 || isLoading}
            >
              Previous
            </button>
            <span className="plan-muted">
              Page {page} · Sorted by {activeSort ? `${activeSort.columnKey} ${activeSort.direction.toLowerCase()}` : 'default order'}
            </span>
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={() => setPage(page + 1)}
              disabled={pageEnd >= total || isLoading}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {(isDiagnosticsLoading || diagnostics || diagnosticsError) ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={closeDiagnostics} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>Workflow Diagnostics</h3>
                <p>{diagnostics?.Runtime.RecordTitle || diagnostics?.Runtime.EntityId || 'Loading diagnostics.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={closeDiagnostics}>
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
                    <p>{diagnostics.RouteDecision?.ApprovalAuthorityLabel || diagnostics.RouteDecision?.ApprovalRoute || 'Not resolved'}</p>
                    <p className="plan-muted">
                      CGIS: {diagnostics.RouteDecision?.RequiresCgisApproval ? 'Yes' : 'No'} · Board: {diagnostics.RouteDecision?.RequiresBoard ? 'Yes' : 'No'} · BPP: {diagnostics.RouteDecision?.RequiresBpp ? 'Yes' : 'No'}
                    </p>
                    <p className="plan-muted">{diagnostics.RouteDecision?.GovernanceBodyName || 'Direct executive route'}</p>
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
