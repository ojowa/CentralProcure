'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditHistoryItem, AuditWorkflowDiagnosticsResponse, InternalModule } from '../types/internal';
import { fetchAuditHistoryPage, fetchAuditWorkflowDiagnostics } from '../services/auditService';

const formatDateTimeShort = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDateShort = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const toTitle = (value?: string | null) => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'accounting_officer_review') return 'CGIS Approval';
  return value
    ? value.replace(/_/g, ' ').split(' ').map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part)).join(' ')
    : 'Unspecified';
};

const getStatusVariant = (value?: string | null): 'success' | 'warning' | 'danger' | 'neutral' => {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('reject') || normalized.includes('hold') || normalized.includes('cancel')) return 'danger';
  if (normalized.includes('escalat') || normalized.includes('review')) return 'warning';
  if (normalized.includes('approv') || normalized.includes('complet')) return 'success';
  return 'neutral';
};

const getSourceVariant = (value: string): 'success' | 'warning' | 'neutral' => {
  switch (value.toLowerCase()) {
    case 'manual': return 'warning';
    case 'system':
    case 'scheduler': return 'success';
    default: return 'neutral';
  }
};

type ViewMode = 'timeline' | 'table';

interface FilterState {
  entityType: string;
  actor: string;
  transitionSource: string;
  query: string;
  dateFrom: string;
  dateTo: string;
}

type Props = {
  module: InternalModule;
  token?: string | null;
};

export const AuditTrailWorkspace = ({ module, token }: Props) => {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedEvent, setSelectedEvent] = useState<AuditHistoryItem | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
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
        sortBy,
        sortDir
      });
      setEvents(next.Items);
      setTotal(next.Total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load audit history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token, filters.entityType, filters.actor, filters.transitionSource, filters.query, filters.dateFrom, filters.dateTo, page, pageSize, sortBy, sortDir]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setPage(1);
    setFilters({ entityType: '', actor: '', transitionSource: '', query: '', dateFrom: '', dateTo: '' });
  };

  const handleExport = () => {
    const headers = ['Timestamp', 'Entity Type', 'Entity ID', 'From Stage', 'To Stage', 'Status', 'Source', 'Actor', 'Reason'];
    const rows = events.map((e) => [formatDateTimeShort(e.CreatedAt), e.EntityType, e.EntityId, e.FromStageTitle || e.FromStageKey || '', e.ToStageTitle, e.StageStatus || '', e.TransitionSource, e.Actor || '', e.TransitionReason || '']);
    const csv = [headers, ...rows].map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
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
    if (!token) return;
    setSelectedEvent(event);
    setIsDiagnosticsLoading(true);
    try {
      const next = await fetchAuditWorkflowDiagnostics(token, event.EntityType, event.EntityId);
      setDiagnostics(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
    } finally {
      setIsDiagnosticsLoading(false);
    }
  };

  const closeDiagnostics = () => { setSelectedEvent(null); setDiagnostics(null); };
  const toggleEventExpand = (id: string) => { setExpandedEvents((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  const transitionSources = useMemo(() => Array.from(new Set(events.map((e) => e.TransitionSource))).sort((a, b) => a.localeCompare(b)), [events]);
  const uniqueEntities = useMemo(() => new Set(events.map((e) => `${e.EntityType}:${e.EntityId}`)).size, [events]);
  const escalatedCount = useMemo(() => events.filter((e) => { const s = (e.StageStatus || '').toLowerCase(); return s.includes('escalat') || e.ToStageKey === 'administrative_review' || e.ToStageKey === 'bpp_no_objection'; }).length, [events]);
  const systemEventsCount = useMemo(() => events.filter((e) => !e.Actor || e.Actor === 'System').length, [events]);
  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  const groupedEvents = useMemo(() => {
    const groups: Record<string, AuditHistoryItem[]> = {};
    events.forEach((e) => { const date = formatDateShort(e.CreatedAt); if (!groups[date]) groups[date] = []; groups[date].push(e); });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [events]);

  const StatusBadge = ({ status }: { status?: string | null }) => {
    const variant = getStatusVariant(status);
    return <span className={`app-badge app-badge--${variant}`}>{status || 'No status'}</span>;
  };

  const SourceBadge = ({ source }: { source: string }) => {
    const variant = getSourceVariant(source);
    const label = toTitle(source);
    return <span className={`app-badge app-badge--${variant}`}>{label}</span>;
  };

  return (
    <section className="app-workspace audit-trail-workspace">
      {/* Hero Header */}
      <header className="app-workspace__hero">
        <div className="app-workspace__title-group">
          <div className="app-kicker"><span className="app-kicker__dot" />Immutable Workflow Evidence</div>
          <h1 className="app-workspace__title">{module.title}</h1>
          <p className="app-workspace__description">{module.description}</p>
        </div>
        <div className="app-workspace__actions">
          <button type="button" className="app-btn app-btn--secondary" onClick={handleExport}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export CSV
          </button>
          <button type="button" className="app-btn app-btn--secondary" onClick={() => void load()} disabled={isLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
            {isLoading ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="app-alert app-alert--error">{error}</div>}

      {/* Stats Cards */}
      <div className="app-stats-grid">
        <div className="app-stat-card">
          <div className="app-stat-card__icon app-stat-card__icon--primary"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></div>
          <div className="app-stat-card__content">
            <span className="app-stat-card__value">{events.length}</span>
            <span className="app-stat-card__label">Events In View</span>
          </div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__icon app-stat-card__icon--success"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
          <div className="app-stat-card__content">
            <span className="app-stat-card__value">{total}</span>
            <span className="app-stat-card__label">Filtered Total</span>
          </div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__icon app-stat-card__icon--warning"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg></div>
          <div className="app-stat-card__content">
            <span className="app-stat-card__value">{escalatedCount}</span>
            <span className="app-stat-card__label">Escalations</span>
          </div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__icon app-stat-card__icon--info"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg></div>
          <div className="app-stat-card__content">
            <span className="app-stat-card__value">{uniqueEntities}</span>
            <span className="app-stat-card__label">Unique Records</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="app-filters-bar">
        <div className="app-filters-bar__group">
          <div className="app-field app-field--sm">
            <label>Entity Type</label>
            <input type="text" value={filters.entityType} onChange={(e) => updateFilter('entityType', e.target.value)} placeholder="e.g., contract, tender" />
          </div>
          <div className="app-field app-field--sm">
            <label>Actor</label>
            <input type="text" value={filters.actor} onChange={(e) => updateFilter('actor', e.target.value)} placeholder="Email or name" />
          </div>
          <div className="app-field app-field--sm">
            <label>Source</label>
            <select value={filters.transitionSource} onChange={(e) => updateFilter('transitionSource', e.target.value)}>
              <option value="">All sources</option>
              {transitionSources.map((s) => <option key={s} value={s}>{toTitle(s)}</option>)}
            </select>
          </div>
          <div className="app-field app-field--sm">
            <label>Search</label>
            <input type="text" value={filters.query} onChange={(e) => updateFilter('query', e.target.value)} placeholder="Record title, reason..." />
          </div>
          <div className="app-field app-field--sm app-field--date-range">
            <label>Date Range</label>
            <div className="app-date-range">
              <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
              <span>to</span>
              <input type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="app-filters-bar__actions">
          <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={resetFilters}>Reset</button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="app-view-toggle">
        <button className={`app-view-toggle__btn ${viewMode === 'timeline' ? 'app-view-toggle__btn--active' : ''}`} onClick={() => setViewMode('timeline')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
          Timeline View
        </button>
        <button className={`app-view-toggle__btn ${viewMode === 'table' ? 'app-view-toggle__btn--active' : ''}`} onClick={() => setViewMode('table')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
          Table View
        </button>
      </div>

      {/* Content */}
      <div className="app-content-area">
        {isLoading && events.length === 0 ? (
          <div className="app-loading">Loading audit trail...</div>
        ) : events.length === 0 ? (
          <div className="app-empty-state">
            <div className="app-empty-state__icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
            <p>No workflow history matches the selected filters.</p>
          </div>
        ) : viewMode === 'timeline' ? (
          /* Timeline View */
          <div className="audit-timeline">
            {groupedEvents.map(([date, dayEvents]) => (
              <div key={date} className="audit-timeline__day">
                <div className="audit-timeline__date-header">
                  <span className="audit-timeline__date">{date}</span>
                  <span className="audit-timeline__count">{dayEvents.length} events</span>
                </div>
                <div className="audit-timeline__events">
                  {dayEvents.map((event) => {
                    const isExpanded = expandedEvents.has(event.HistoryId);
                    return (
                      <div key={event.HistoryId} className={`audit-event-card ${isExpanded ? 'audit-event-card--expanded' : ''}`}>
                        <div className="audit-event-card__header" onClick={() => toggleEventExpand(event.HistoryId)}>
                          <div className="audit-event-card__time">{formatDateTimeShort(event.CreatedAt).split(',')[1]}</div>
                          <div className="audit-event-card__title">
                            <span className="audit-event-card__entity">{event.RecordTitle || `${toTitle(event.EntityType)} · ${event.EntityId.slice(0, 8)}`}</span>
                            <span className="audit-event-card__type">{toTitle(event.EntityType)}</span>
                          </div>
                          <div className="audit-event-card__badges">
                            <StatusBadge status={event.StageStatus} />
                            <SourceBadge source={event.TransitionSource} />
                          </div>
                          <button className="audit-event-card__chevron" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : '' }}><polyline points="6 9 12 15 18 9" /></svg>
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="audit-event-card__body">
                            <div className="audit-event-card__transition">
                              <div className="audit-event-card__stage">
                                <span className="audit-event-card__stage-label">From</span>
                                <span className="audit-event-card__stage-name">{event.FromStageTitle || event.FromStageKey || 'Start'}</span>
                              </div>
                              <div className="audit-event-card__arrow">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                              </div>
                              <div className="audit-event-card__stage">
                                <span className="audit-event-card__stage-label">To</span>
                                <span className="audit-event-card__stage-name">{event.ToStageTitle}</span>
                              </div>
                            </div>
                            <div className="audit-event-card__meta">
                              <div className="audit-event-card__meta-item">
                                <span className="audit-event-card__meta-label">Actor</span>
                                <span className="audit-event-card__meta-value">{event.Actor || 'System'}</span>
                              </div>
                              <div className="audit-event-card__meta-item">
                                <span className="audit-event-card__meta-label">Entity ID</span>
                                <span className="audit-event-card__meta-value">{event.EntityId}</span>
                              </div>
                              <div className="audit-event-card__meta-item">
                                <span className="audit-event-card__meta-label">Current Stage</span>
                                <span className="audit-event-card__meta-value">{event.CurrentStageTitle || event.CurrentStageKey || 'Not resolved'}</span>
                              </div>
                            </div>
                            {event.TransitionReason && (
                              <div className="audit-event-card__reason">
                                <span className="audit-event-card__meta-label">Reason</span>
                                <p>{event.TransitionReason}</p>
                              </div>
                            )}
                            <div className="audit-event-card__actions">
                              <button className="app-btn app-btn--sm" onClick={() => openDiagnostics(event)}>View Diagnostics</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead>
                <tr>
                  <th onClick={() => { setSortBy('createdAt'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>Timestamp {sortBy === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th>Record</th>
                  <th>From → To</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Actor</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.HistoryId}>
                    <td className="app-table__cell--nowrap">{formatDateTimeShort(event.CreatedAt)}</td>
                    <td>
                      <div className="app-case-info">
                        <span className="app-case-info__title">{event.RecordTitle || 'Untitled'}</span>
                        <span className="app-case-info__id">{toTitle(event.EntityType)} · {event.EntityId.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="app-transition">
                        <span>{event.FromStageTitle || event.FromStageKey || 'Start'}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                        <span>{event.ToStageTitle}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={event.StageStatus} /></td>
                    <td><SourceBadge source={event.TransitionSource} /></td>
                    <td>{event.Actor || 'System'}</td>
                    <td>
                      <button className="app-btn app-btn--sm" onClick={() => openDiagnostics(event)}>Diagnostics</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="app-pagination">
        <span className="app-pagination__meta">Showing {pageStart}-{pageEnd} of {total}</span>
        <div className="app-pagination__controls">
          <button type="button" className="app-btn app-btn--secondary" onClick={() => setPage(page - 1)} disabled={page <= 1}>Previous</button>
          <select className="app-select app-select--sm" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
          <button type="button" className="app-btn app-btn--secondary" onClick={() => setPage(page + 1)} disabled={pageEnd >= total}>Next</button>
        </div>
      </div>

      {/* Diagnostics Modal */}
      {(selectedEvent || isDiagnosticsLoading) && (
        <div className="app-modal" role="dialog" aria-modal="true">
          <div className="app-modal__backdrop" onClick={closeDiagnostics} />
          <div className="app-modal__content app-modal__content--lg">
            <div className="app-modal__header">
              <div>
                <h3>Workflow Diagnostics</h3>
                <p className="app-muted">{selectedEvent?.RecordTitle || selectedEvent?.EntityId}</p>
              </div>
              <button type="button" className="app-btn app-btn--ghost" onClick={closeDiagnostics}>Close</button>
            </div>
            <div className="app-modal__body">
              {isDiagnosticsLoading ? (
                <div className="app-loading">Loading diagnostics...</div>
              ) : diagnostics ? (
                <div className="diagnostics-content">
                  <div className="app-card-grid">
                    <div className="app-card">
                      <h4 className="app-card__title">Current Stage</h4>
                      <p className="app-card__value">{diagnostics.Runtime.CurrentStageTitle}</p>
                      <p className="app-muted">{diagnostics.Runtime.CurrentStatus || 'No live status'}</p>
                    </div>
                    <div className="app-card">
                      <h4 className="app-card__title">Approval Route</h4>
                      <p className="app-card__value">{diagnostics.RouteDecision?.ApprovalAuthorityLabel || diagnostics.RouteDecision?.ApprovalRoute || 'Not resolved'}</p>
                      <p className="app-muted">
                        CGIS: {diagnostics.RouteDecision?.RequiresCgisApproval ? 'Yes' : 'No'} · Board: {diagnostics.RouteDecision?.RequiresBoard ? 'Yes' : 'No'} · BPP: {diagnostics.RouteDecision?.RequiresBpp ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div className="app-card">
                      <h4 className="app-card__title">Role Context</h4>
                      <p className="app-card__value">{diagnostics.RoleKey || 'No role snapshot'}</p>
                      <p className="app-muted">{diagnostics.GrantedActions.length} granted action(s)</p>
                    </div>
                    <div className="app-card">
                      <h4 className="app-card__title">Last Transition</h4>
                      <p className="app-card__value">{diagnostics.Runtime.LastTransitionReason || 'No reason recorded'}</p>
                      <p className="app-muted">{formatDateTimeShort(diagnostics.Runtime.UpdatedAt)}</p>
                    </div>
                  </div>

                  {diagnostics.TransitionChecks.length > 0 && (
                    <div className="app-section">
                      <h4 className="app-section__title">Transition Checks</h4>
                      <div className="app-table-wrapper">
                        <table className="app-table app-table--compact">
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
                                <td><span className={`app-badge app-badge--${check.IsAllowed ? 'success' : 'danger'}`}>{check.IsAllowed ? 'Yes' : 'No'}</span></td>
                                <td>{check.Message || 'Allowed by policy'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {diagnostics.RecentHistory.length > 0 && (
                    <div className="app-section">
                      <h4 className="app-section__title">Recent History</h4>
                      <div className="app-timeline-mini">
                        {diagnostics.RecentHistory.map((entry, idx) => (
                          <div key={entry.HistoryId} className="app-timeline-mini__item">
                            <div className={`app-timeline-mini__dot ${idx === 0 ? 'app-timeline-mini__dot--current' : ''}`} />
                            <div className="app-timeline-mini__content">
                              <span className="app-timeline-mini__time">{formatDateTimeShort(entry.CreatedAt)}</span>
                              <span className="app-timeline-mini__stage">{entry.FromStageKey || 'Start'} → {entry.ToStageTitle}</span>
                              <StatusBadge status={entry.StageStatus} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
