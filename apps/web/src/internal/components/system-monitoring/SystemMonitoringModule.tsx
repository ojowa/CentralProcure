'use client';

import { useEffect, useState } from 'react';
import type { InternalModule, MonitoringAlertItem, MonitoringOverview, MonitoringStageLoadItem, MonitoringStatusItem } from '../../types/internal';
import { fetchModuleData } from '../../services/moduleService.shared';

type Props = {
  module: InternalModule;
  token: string | null;
  initialData?: unknown;
};

const statusTone = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'critical') return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
  if (normalized === 'warning' || normalized === 'degraded') return { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' };
  return { bg: '#ecfdf5', border: '#bbf7d0', text: '#166534' };
};

const cardStyle = { border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '16px', padding: '18px', background: '#fff' } as const;

const renderStatusGrid = (items: MonitoringStatusItem[]) => (
  <div className="portal-module-grid" style={{ marginTop: '16px' }}>
    {items.map((item) => {
      const tone = statusTone(item.Status);
      return (
        <article key={item.Key} style={{ ...cardStyle, display: 'grid', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{item.Label}</h3>
            <span style={{ background: tone.bg, color: tone.text, border: `1px solid ${tone.border}`, borderRadius: '999px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>
              {item.Status}
            </span>
          </div>
          <strong style={{ fontSize: '28px', lineHeight: 1 }}>{item.Count}</strong>
          <p style={{ margin: 0, color: '#475569' }}>{item.Summary}</p>
        </article>
      );
    })}
  </div>
);

const renderAlerts = (alerts: MonitoringAlertItem[]) => {
  if (!alerts.length) {
    return <div className="plan-empty" style={{ marginTop: '16px' }}>No active monitoring alerts were detected from live operational data.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
      {alerts.map((alert) => {
        const tone = statusTone(alert.Severity);
        return (
          <article key={`${alert.Source}:${alert.Title}`} style={{ ...cardStyle, borderColor: tone.border, background: tone.bg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div>
                <strong>{alert.Title}</strong>
                <div style={{ color: '#475569', marginTop: '4px' }}>{alert.Source}</div>
              </div>
              <span style={{ color: tone.text, fontWeight: 700 }}>{alert.Severity}</span>
            </div>
            <p style={{ margin: '12px 0 0', color: '#334155' }}>{alert.Detail}</p>
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', color: '#475569', fontSize: '14px' }}>
              <span>Affected: {alert.AffectedCount}</span>
              <span>Oldest Age: {alert.OldestAgeDays ?? 0} days</span>
            </div>
          </article>
        );
      })}
    </div>
  );
};

const renderStageLoad = (items: MonitoringStageLoadItem[]) => {
  if (!items.length) {
    return <div className="plan-empty" style={{ marginTop: '16px' }}>No workflow runtime records are currently available.</div>;
  }

  return (
    <div className="portal-table-container">
    <table className="plan-table" style={{ marginTop: '16px' }}>
      <thead>
        <tr>
          <th>Stage</th>
          <th>Key</th>
          <th>Active Records</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.StageKey}>
            <td>{item.StageTitle}</td>
            <td>{item.StageKey}</td>
            <td>{item.ActiveCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
};

export const SystemMonitoringModule = ({ module, token, initialData }: Props) => {
  const [overview, setOverview] = useState<MonitoringOverview | null>((initialData as MonitoringOverview | null) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialData);

  const load = async () => {
    if (!token) {
      setError('Authentication is required to view system monitoring.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchModuleData('system-monitoring', token) as MonitoringOverview;
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring overview.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      void load();
    }
  }, [initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="portal-module">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <button type="button" className="plan-button plan-button--secondary" onClick={() => void load()} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? <div className="portal-alert">{error}</div> : null}
      {isLoading && !overview ? <div className="plan-loading">Loading live monitoring data...</div> : null}

      {overview ? (
        <>
          <div className="portal-module-grid" style={{ marginTop: '16px' }}>
            <article style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>Generated</h3>
              <strong>{new Date(overview.GeneratedAtUtc).toLocaleString()}</strong>
            </article>
            <article style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>Open Alerts</h3>
              <strong>{overview.TotalAlerts}</strong>
              <div style={{ color: '#475569', marginTop: '6px' }}>{overview.CriticalAlerts} critical, {overview.WarningAlerts} warning</div>
            </article>
            <article style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>Services Tracked</h3>
              <strong>{overview.Services.length}</strong>
              <div style={{ color: '#475569', marginTop: '6px' }}>{overview.Integrations.length} integration checks</div>
            </article>
          </div>

          <section style={{ marginTop: '24px' }}>
            <h3>Service Health</h3>
            <p className="plan-muted">Core platform services and domain surfaces derived from live operational data.</p>
            {renderStatusGrid(overview.Services)}
          </section>

          <section style={{ marginTop: '24px' }}>
            <h3>Integration Watch</h3>
            <p className="plan-muted">Operational checkpoints for CGIS approvals, vendor onboarding, BPP escalation, and complaint handling.</p>
            {renderStatusGrid(overview.Integrations)}
          </section>

          <section style={{ marginTop: '24px' }}>
            <h3>Live Alerts</h3>
            <p className="plan-muted">Alerts are derived from overdue or inconsistent runtime records, not from placeholder rules.</p>
            {renderAlerts(overview.Alerts)}
          </section>

          <section style={{ marginTop: '24px' }}>
            <h3>Workflow Load</h3>
            <p className="plan-muted">Top active workflow stages currently occupying runtime records.</p>
            {renderStageLoad(overview.StageLoad)}
          </section>
        </>
      ) : null}
    </section>
  );
};
