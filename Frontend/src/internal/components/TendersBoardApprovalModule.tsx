import React, { useState, useEffect } from 'react';
import type { InternalModule, RequisitionSummary, EvaluationReportItem } from '../types/internal';
import { fetchModuleData, updateRequisitionStatus, fetchEvaluationReports, logEvaluationAction } from '../services/moduleService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: any;
}

export const TendersBoardApprovalModule = ({ module, token, role, initialData }: Props) => {
  const [activeTab, setActiveModule] = useState<'requisitions' | 'evaluations'>('requisitions');
  const [requisitions, setRequisitions] = useState<RequisitionSummary[]>([]);
  const [reports, setReports] = useState<EvaluationReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, activeTab]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (activeTab === 'requisitions') {
        const data: any = await fetchModuleData('requisition-history', token);
        // Filter for those in Board Review
        setRequisitions((data?.Items || []).filter((r: any) => r.Status === 'Board Review' || r.Status === 'Under Review'));
      } else {
        const data = await fetchEvaluationReports('Submitted', token);
        setReports(data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequisition = async (id: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await updateRequisitionStatus(id, 'Approved', token);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveEvaluation = async (report: EvaluationReportItem) => {
    if (!token) return;
    setLoading(true);
    try {
      await logEvaluationAction({
        ActionType: 'RecommendAward',
        TenderId: report.TenderId,
        ReportCode: report.ReportCode,
        Justification: 'Approved by Tenders Board.',
        Recommendation: 'Qualified'
      }, token);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="portal-module">
      <header className="portal-module__header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
      </header>

      <div className="portal-tabs" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <button 
          className={`plan-button ${activeTab === 'requisitions' ? '' : 'plan-button--secondary'}`}
          onClick={() => setActiveModule('requisitions')}
        >
          Requisition Approvals
        </button>
        <button 
          className={`plan-button ${activeTab === 'evaluations' ? '' : 'plan-button--secondary'}`}
          onClick={() => setActiveModule('evaluations')}
        >
          Award Approvals (Evaluation Reports)
        </button>
      </div>

      {error && <div className="portal-alert">{error}</div>}
      {loading && <div className="plan-loading">Processing board queue...</div>}

      {activeTab === 'requisitions' && (
        <div className="portal-table-container">
          <h3>Pending Requisition Reviews</h3>
          <table className="portal-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Department</th>
                <th>Estimate</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map(r => (
                <tr key={r.RequisitionId}>
                  <td>{r.Title}</td>
                  <td>{r.Department}</td>
                  <td>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(r.TotalEstimate)}</td>
                  <td><span className="plan-badge">{r.Status}</span></td>
                  <td>
                    <button className="plan-button plan-button--sm" onClick={() => handleApproveRequisition(r.RequisitionId)}>Approve for Tender</button>
                  </td>
                </tr>
              ))}
              {requisitions.length === 0 && !loading && (
                <tr><td colSpan={5} className="plan-empty">No requisitions pending board review.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'evaluations' && (
        <div className="portal-table-container">
          <h3>Evaluation Reports Pending Award</h3>
          <table className="portal-table">
            <thead>
              <tr>
                <th>Report Code</th>
                <th>Tender</th>
                <th>Recommendation</th>
                <th>Score Summary</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.ReportCode}>
                  <td><strong>{r.ReportCode}</strong></td>
                  <td>{r.TenderTitle}</td>
                  <td>{r.Recommendation}</td>
                  <td>{r.ScoreSummary}</td>
                  <td>
                    <button className="plan-button plan-button--sm" onClick={() => handleApproveEvaluation(r)}>Approve Award</button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && !loading && (
                <tr><td colSpan={5} className="plan-empty">No evaluation reports pending award approval.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
