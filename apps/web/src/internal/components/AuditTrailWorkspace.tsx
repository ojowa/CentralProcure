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

const formatTimeOnly = (value?: string | null) => {
  if (!value) return '--:--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--:--';
  return parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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

type ViewMode = 'timeline' | 'table';

interface FilterState {
  entityType: string;
  actor: string;
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
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditHistoryItem | null>(null);
  const [diagnostics, setDiagnostics] = useState<AuditWorkflowDiagnosticsResponse | null>(null);
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    entityType: '',
    actor: '',
    query: '',
    dateFrom: '',
    dateTo: ''
  });
  const [events, setEvents] = useState<AuditHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => { void load(); }, [token, filters.entityType, filters.actor, filters.query, filters.dateFrom, filters.dateTo, page, pageSize, sortBy, sortDir]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setPage(1);
    setFilters({ entityType: '', actor: '', query: '', dateFrom: '', dateTo: '' });
    setShowFilters(false);
  };

  const handleExport = () => {
    const headers = ['Timestamp', 'Entity Type', 'Entity ID', 'Action', 'Performed By', 'Notes'];
    const rows = events.map((e) => [formatDateTimeShort(e.CreatedAt), e.EntityType, e.EntityId, e.Action, e.PerformedBy || '', e.Notes || '']);
    const csv = [headers, ...rows].map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
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
  const toggleEventExpand = (id: string) => { setExpandedEvent((prev) => prev === id ? null : id); };

  const uniqueEntities = useMemo(() => new Set(events.map((e) => `${e.EntityType}:${e.EntityId}`)).size, [events]);
  const escalatedCount = useMemo(() => events.filter((e) => { const s = (e.Action || '').toLowerCase(); return s.includes('escalat') || s.includes('reject'); }).length, [events]);
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

  return (
    <section className="portal-module audit-trail-workspace">
      {/* Simple Header */}
      <header className="app-workspace__hero">
        <div className="app-workspace__title-group">
          <h1 className="app-workspace__title">{module.title}</h1>
          <p className="app-workspace__description">{module.description}</p>
        </div>
        <div className="app-workspace__actions">
          <button type="button" className="app-btn app-btn--secondary" onClick={handleExport} title="Export to CSV">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export
          </button>
          <button type="button" className="app-btn app-btn--secondary" onClick={() => void load()} disabled={isLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
            {isLoading ? '...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="app-alert app-alert--error">{error}</div>}

      {/* Simple Stats */}
      <div className="audit-trail__stats">
        <div className="audit-trail__stat">
          <span className="audit-trail__stat-value">{total.toLocaleString()}</span>
          <span className="audit-trail__stat-label">Total Events</span>
        </div>
        <div className="audit-trail__stat">
          <span className="audit-trail__stat-value">{uniqueEntities}</span>
          <span className="audit-trail__stat-label">Records</span>
        </div>
        <div className="audit-trail__stat">
          <span className="audit-trail__stat-value">{escalatedCount}</span>
          <span className="audit-trail__stat-label">Escalations</span>
        </div>
      </div>

      {/* Simple Search & Filters */}
      <div className="audit-trail__toolbar">
        <div className="audit-trail__search-row">
          <div className="audit-trail__search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="text"
              value={filters.query}
              onChange={(e) => updateFilter('query', e.target.value)}
              placeholder="Search records, actors, or reasons..."
            />
            {filters.query && (
              <button className="audit-trail__search-clear" onClick={() => updateFilter('query', '')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
          <button
            type="button"
            className={`app-btn app-btn--secondary app-btn--sm ${showFilters ? 'app-btn--active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="audit-trail__filters">
            <div className="audit-trail__filter-field">
              <label>Entity Type</label>
              <input type="text" value={filters.entityType} onChange={(e) => updateFilter('entityType', e.target.value)} placeholder="e.g., contract" />
            </div>
            <div className="audit-trail__filter-field">
              <label>Actor</label>
              <input type="text" value={filters.actor} onChange={(e) => updateFilter('actor', e.target.value)} placeholder="Email or name" />
            </div>
            <div className="audit-trail__filter-field">
              <label>From</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
            </div>
            <div className="audit-trail__filter-field">
              <label>To</label>
              <input type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
            </div>
            <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={resetFilters}>Clear all</button>
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div className="app-view-toggle">
        <button className={`app-view-toggle__btn ${viewMode === 'timeline' ? 'app-view-toggle__btn--active' : ''}`} onClick={() => setViewMode('timeline')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
          Timeline
        </button>
        <button className={`app-view-toggle__btn ${viewMode === 'table' ? 'app-view-toggle__btn--active' : ''}`} onClick={() => setViewMode('table')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
          Table
        </button>
      </div>

      {/* Content */}
      <div className="app-content-area">
        {isLoading && events.length === 0 ? (
          <div className="app-loading">Loading audit trail...</div>
        ) : events.length === 0 ? (
          <div className="app-empty-state">
            <div className="app-empty-state__icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
            <p>No events found matching your filters.</p>
          </div>
        ) : viewMode === 'timeline' ? (
          /* Simple Timeline View */
          <div className="audit-timeline">
            {groupedEvents.map(([date, dayEvents]) => (
              <div key={date} className="audit-timeline__day">
                <div className="audit-timeline__date-header">
                  <span className="audit-timeline__date">{date}</span>
                  <span className="audit-timeline__count">{dayEvents.length}</span>
                </div>
                <div className="audit-timeline__events">
                  {dayEvents.map((event) => {
                    const isExpanded = expandedEvent === event.AuditId;
                    return (
                      <div key={event.AuditId} className={`audit-event-card ${isExpanded ? 'audit-event-card--expanded' : ''}`}>
                        <div className="audit-event-card__header" onClick={() => toggleEventExpand(event.AuditId)}>
                          <div className="audit-event-card__time">{formatTimeOnly(event.CreatedAt)}</div>
                          <div className="audit-event-card__info">
                            <span className="audit-event-card__title">{toTitle(event.EntityType)} · {event.EntityId.slice(0, 6)}</span>
                            <span className="audit-event-card__subtitle">{event.Action}</span>
                          </div>
                          <div className="audit-event-card__meta">
                            <StatusBadge status={event.Action} />
                            <span className="audit-event-card__actor">{event.PerformedBy || 'System'}</span>
                          </div>
                          <button className="audit-event-card__chevron" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : '' }}><polyline points="6 9 12 15 18 9" /></svg>
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="audit-event-card__body">
                            <div className="audit-event-card__details">
                              <div><span>Entity:</span> {toTitle(event.EntityType)}</div>
                              <div><span>ID:</span> {event.EntityId}</div>
                              <div><span>Action:</span> {event.Action}</div>
                              <div><span>By:</span> {event.PerformedBy || 'System'}</div>
                            </div>
                            {event.Notes && (
                              <div className="audit-event-card__reason">{event.Notes}</div>
                            )}
                            <button className="app-btn app-btn--sm" onClick={() => openDiagnostics(event)}>View Details</button>
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
          /* Simple Table View */
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead>
                <tr>
                  <th onClick={() => { setSortBy('createdAt'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>Time {sortBy === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Performed By</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.AuditId}>
                    <td className="app-table__cell--nowrap">{formatDateTimeShort(event.CreatedAt)}</td>
                    <td>
                      <div className="app-case-info">
                        <span className="app-case-info__title">{toTitle(event.EntityType)}</span>
                        <span className="app-case-info__id">{event.EntityId.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={event.Action} /></td>
                    <td>{event.PerformedBy || 'System'}</td>
                    <td>{event.Notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simple Pagination */}
      <div className="app-pagination">
        <span className="app-pagination__meta">{pageStart}-{pageEnd} of {total}</span>
        <div className="app-pagination__controls">
          <button type="button" className="app-btn app-btn--secondary app-btn--sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Prev</button>
          <select className="app-select app-select--sm" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button type="button" className="app-btn app-btn--secondary app-btn--sm" onClick={() => setPage(page + 1)} disabled={pageEnd >= total}>Next</button>
        </div>
      </div>

      {(selectedEvent || isDiagnosticsLoading) && (
        <div className="app-modal" role="dialog" aria-modal="true">
          <div className="app-modal__backdrop" onClick={closeDiagnostics} />
          <div className="app-modal__content">
            <div className="app-modal__header">
              <h3>Event Details</h3>
              <button type="button" className="app-btn app-btn--ghost" onClick={closeDiagnostics}>Close</button>
            </div>
            <div className="app-modal__body audit-trail__modal-body">
              {isDiagnosticsLoading ? (
                <div className="app-loading">Loading...</div>
              ) : diagnostics ? (
                <div className="audit-trail__details">
                  <div className="audit-trail__info-grid">
                    <div className="audit-trail__info-item">
                      <span>Current Stage</span>
                      <strong>{diagnostics.Runtime.CurrentStageTitle}</strong>
                    </div>
                    <div className="audit-trail__info-item">
                      <span>Status</span>
                      <strong>{diagnostics.Runtime.CurrentStatus || 'N/A'}</strong>
                    </div>
                    <div className="audit-trail__info-item">
                      <span>Approval Route</span>
                      <strong>{diagnostics.RouteDecision?.ApprovalAuthorityLabel || 'Standard'}</strong>
                    </div>
                    <div className="audit-trail__info-item">
                      <span>Role</span>
                      <strong>{toTitle(diagnostics.RoleKey) || 'N/A'}</strong>
                    </div>
                  </div>

                  {diagnostics.TransitionChecks.length > 0 && (
                    <div className="audit-trail__section">
                      <h4>Available Transitions</h4>
                      <div className="audit-trail__checks">
                        {diagnostics.TransitionChecks.map((check) => (
                          <div key={check.RequestedStageKey} className={`audit-trail__check ${check.IsAllowed ? 'audit-trail__check--allowed' : ''}`}>
                            <span className="audit-trail__check-stage">{check.RequestedStageTitle}</span>
                            <span className={`audit-trail__check-status ${check.IsAllowed ? 'allowed' : 'blocked'}`}>
                              {check.IsAllowed ? '✓ Allowed' : '✕ Blocked'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {diagnostics.RecentHistory.length > 0 && (
                    <div className="audit-trail__section">
                      <h4>Recent History</h4>
                      <div className="audit-trail__history">
                        {diagnostics.RecentHistory.map((entry) => (
                          <div key={entry.HistoryId} className="audit-trail__history-item">
                            <span className="audit-trail__history-time">{formatDateTimeShort(entry.CreatedAt)}</span>
                            <span className="audit-trail__history-transition">
                              {entry.FromStageKey || 'Start'} → {entry.ToStageTitle}
                            </span>
                            <StatusBadge status={entry.StageStatus} />
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
