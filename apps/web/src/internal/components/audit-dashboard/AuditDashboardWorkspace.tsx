'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AuditCloseoutItem, AuditSummaryResponse, InternalModule } from '../../types/internal';
import { fetchAuditCloseouts, fetchAuditSummary } from '../../services/auditService';

// Redesigned sub-components
import { AuditMetrics } from './AuditMetrics';
import { AuditSubNav, AuditViewType } from './AuditSubNav';
import { AuditCloseoutRegister } from './AuditCloseoutRegister';
import { AuditWorkflowTimeline } from './AuditWorkflowTimeline';
import { AuditComplianceHealth } from './AuditComplianceHealth';

type Props = {
  module: InternalModule;
  token?: string | null;
};

export const AuditDashboardWorkspace = ({ module, token }: Props) => {
  const searchParams = useSearchParams();
  const [activeView, setActiveViewState] = useState<AuditViewType>(
    (searchParams.get('view') as AuditViewType) || 'overview'
  );
  const [summary, setSummary] = useState<AuditSummaryResponse | null>(null);
  const [closeouts, setCloseouts] = useState<AuditCloseoutItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const setActiveView = (v: AuditViewType) => {
    setActiveViewState(v);
    const params = new URLSearchParams(window.location.search);
    params.set('view', v);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  };

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

  return (
    <section className="portal-module audit-dashboard animate-fade-up">
      <header className="budget-workspace__hero">
        <div className="budget-workspace__title-group">
          <div className="admin-kicker">Statutory Oversight & Internal Audit</div>
          <h2>{module.title}</h2>
          <p className="plan-muted">{module.description}</p>
        </div>
        <div className="plan-actions">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => void load()}
            disabled={!token || isLoading}
          >
            {isLoading ? 'Syncing...' : 'Refresh Audit Data'}
          </button>
        </div>
      </header>

      {error ? <div className="portal-alert animate-shake">{error}</div> : null}

      <AuditSubNav activeView={activeView} onViewChange={setActiveView} />

      <div className="audit-workspace-content">
        {activeView === 'overview' && (
          <div className="audit-overview-view">
            <AuditMetrics summary={summary} />
            
            <div className="view-header" style={{ marginTop: '32px' }}>
              <h3>Compliance Health Indicators</h3>
              <p>Automated verification of statutory procurement rules.</p>
            </div>
            <AuditComplianceHealth />

            <div style={{ marginTop: '32px' }}>
              <AuditWorkflowTimeline events={(summary?.RecentEvents ?? []).slice(0, 5)} />
            </div>
          </div>
        )}

        {activeView === 'closeouts' && (
          <div className="audit-closeouts-view">
            <AuditCloseoutRegister 
              closeouts={closeouts}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              isLoading={isLoading}
              onRefresh={load}
            />
          </div>
        )}

        {activeView === 'timeline' && (
          <div className="audit-timeline-view">
            <AuditWorkflowTimeline events={summary?.RecentEvents ?? []} />
          </div>
        )}
      </div>

      <style jsx>{`
        .audit-dashboard {
          display: grid;
          gap: 24px;
        }
        .audit-workspace-content {
          min-height: 400px;
        }
      `}</style>
    </section>
  );
};
