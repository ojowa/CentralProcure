import React, { useEffect, useMemo, useState } from 'react';
import type { EvaluationReportItem, InternalModule } from '../types/internal';
import { fetchEvaluationReportDetail, fetchEvaluationReports } from '../services/evaluationReportService';

type Props = {
  module: InternalModule;
  token: string | null;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : 'Not submitted';

const statusTone = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes('approved') || normalized.includes('accepted')) return 'admin-status--good';
  if (normalized.includes('pending') || normalized.includes('submitted')) return 'admin-status--warn';
  if (normalized.includes('rejected') || normalized.includes('returned')) return 'admin-status--bad';
  return '';
};

export const EvaluationReportModule = ({ module, token }: Props) => {
  const [reports, setReports] = useState<EvaluationReportItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<EvaluationReportItem | null>(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchEvaluationReports(token, { status: status || undefined, query: query || undefined });
        if (!active) return;
        setReports(data);
        const nextId = selectedId && data.some((item) => item.ReportId === selectedId) ? selectedId : data[0]?.ReportId ?? '';
        setSelectedId(nextId);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load evaluation reports.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [token, status, query, selectedId]);

  useEffect(() => {
    if (!token || !selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const data = await fetchEvaluationReportDetail(token, selectedId);
        if (active) setDetail(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load evaluation report detail.');
      } finally {
        if (active) setDetailLoading(false);
      }
    };
    void loadDetail();
    return () => {
      active = false;
    };
  }, [token, selectedId]);

  const summary = useMemo(() => ({
    total: reports.length,
    submitted: reports.filter((item) => item.Status.toLowerCase().includes('submitted')).length,
    approved: reports.filter((item) => item.Status.toLowerCase().includes('approved')).length
  }), [reports]);

  return (
    <section className="admin-hub">
      <header className="admin-hero">
        <div>
          <div className="admin-kicker">{module.controlPurpose}</div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
          <div className="admin-tags">
            <span className="admin-tag">{summary.total} Reports</span>
            <span className="admin-tag">{summary.submitted} Submitted</span>
            <span className="admin-tag">{summary.approved} Approved</span>
          </div>
        </div>
      </header>

      {error ? <div className="portal-alert">{error}</div> : null}

      <div className="admin-grid" style={{ marginTop: '24px' }}>
        <article className="admin-card admin-card--wide">
          <div className="plan-toolbar" style={{ marginBottom: '16px' }}>
            <label className="plan-field">
              <span>Status</span>
              <select className="plan-input" value={status} onChange={(event) => setStatus(event.target.value)} disabled={loading}>
                <option value="">All statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </label>
            <label className="plan-field">
              <span>Search</span>
              <input
                className="plan-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tender, report code, recommendation"
                disabled={loading}
              />
            </label>
          </div>

          <div className="portal-table-container">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Report Code</th>
                  <th>Tender</th>
                  <th>Committee Lead</th>
                  <th>Recommendation</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((item) => (
                  <tr
                    key={item.ReportId}
                    onClick={() => setSelectedId(item.ReportId)}
                    style={{ cursor: 'pointer', background: selectedId === item.ReportId ? 'rgba(15, 23, 42, 0.04)' : undefined }}
                  >
                    <td><strong>{item.ReportCode}</strong></td>
                    <td>{item.TenderTitle}</td>
                    <td>{item.CommitteeLead}</td>
                    <td>{item.Recommendation}</td>
                    <td><span className={`admin-status ${statusTone(item.Status)}`.trim()}>{item.Status}</span></td>
                    <td>{formatDate(item.SubmittedAt)}</td>
                  </tr>
                ))}
                {!reports.length && !loading ? (
                  <tr>
                    <td colSpan={6} className="plan-empty">No live evaluation reports match the current filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-card admin-card--mid">
          <h3>Report Detail</h3>
          {detailLoading ? <div className="plan-loading">Loading evaluation report...</div> : null}
          {!detailLoading && detail ? (
            <div className="admin-list">
              <div><strong>{detail.ReportCode}</strong></div>
              <div>{detail.TenderTitle}</div>
              <div><span className={`admin-status ${statusTone(detail.Status)}`.trim()}>{detail.Status}</span></div>
              <div>Committee Lead: {detail.CommitteeLead}</div>
              <div>Submitted: {formatDate(detail.SubmittedAt)}</div>
              <div>
                <strong>Recommendation</strong>
                <p style={{ marginTop: '6px' }}>{detail.Recommendation}</p>
              </div>
              <div>
                <strong>Score Summary</strong>
                <p style={{ marginTop: '6px', whiteSpace: 'pre-wrap' }}>{detail.ScoreSummary || 'No score summary provided.'}</p>
              </div>
              <div>
                <strong>Evaluation Notes</strong>
                <p style={{ marginTop: '6px', whiteSpace: 'pre-wrap' }}>{detail.Notes || 'No evaluation notes provided.'}</p>
              </div>
            </div>
          ) : null}
          {!detailLoading && !detail ? (
            <div className="plan-empty" style={{ textAlign: 'left' }}>
              Select a live evaluation report to inspect the ranking summary and recommendation.
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
};
