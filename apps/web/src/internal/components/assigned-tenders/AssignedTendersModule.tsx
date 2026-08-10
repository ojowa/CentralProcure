import React, { useEffect, useMemo, useState } from 'react';
import type { AssignedTenderItem, InternalModule, RoleKey } from '../../types/internal';
import { fetchAssignedTenders } from '../../services/moduleService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: RoleKey | null;
  initialData?: unknown;
  onModuleChange: (moduleId: string) => void;
}

const assignmentRoleLabels: Record<string, string> = {
  technical_evaluator: 'Technical Evaluator',
  financial_evaluator: 'Financial Evaluator',
  evaluation_committee: 'Evaluation Committee'
};

const currency = new Intl.DateTimeFormat('en-NG', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

export const AssignedTendersModule = ({ module, token, role, initialData, onModuleChange }: Props) => {
  const [items, setItems] = useState<AssignedTenderItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Array.isArray(initialData)) {
      setItems(initialData as AssignedTenderItem[]);
      return;
    }

    if (!token) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    fetchAssignedTenders(token)
      .then((data) => setItems(Array.isArray(data) ? data : data?.Items ?? []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch assigned tenders.');
      })
      .finally(() => setLoading(false));
  }, [initialData, token]);

  const evaluationModuleId = useMemo(() => 'technical-evaluation', []);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) =>
      [
        item.ReportCode,
        item.TenderTitle,
        item.ProcurementCategory,
        item.EvaluationStatus,
        item.TenderStatus
      ].some((value) => value?.toLowerCase().includes(normalized))
    );
  }, [items, query]);

  return (
    <section className="portal-module">
      <header className="portal-module__header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className="admin-tags">
          <span className="admin-tag">{items.length} assigned</span>
        </div>
      </header>

      {error ? <div className="portal-alert">{error}</div> : null}

      <div className="plan-toolbar" style={{ marginBottom: '16px' }}>
        <label className="plan-field">
          <span>Search Assigned Tenders</span>
          <input
            className="plan-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by report code, tender, category, or status"
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
              <th>Assigned Role</th>
              <th>Category</th>
              <th>Evaluation Status</th>
              <th>Submission Deadline</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={`${item.ReportCode}:${item.TenderId}`}>
                <td><strong>{item.ReportCode}</strong></td>
                <td>
                  <div>{item.TenderTitle}</div>
                  <small className="plan-muted">Tender status: {item.TenderStatus}</small>
                </td>
                <td>{assignmentRoleLabels[item.AssignmentRole] ?? item.AssignmentRole}</td>
                <td>{item.ProcurementCategory}</td>
                <td>{item.EvaluationStatus}</td>
                <td>{item.SubmissionDeadline ? currency.format(new Date(item.SubmissionDeadline)) : 'N/A'}</td>
                <td>
                  <button
                    type="button"
                    className="plan-button plan-button--sm"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.sessionStorage.setItem('assignedTenderFocusId', item.TenderId);
                      }
                      onModuleChange(evaluationModuleId);
                    }}
                  >
                    Open Evaluation
                  </button>
                </td>
              </tr>
            ))}
            {!filteredItems.length && !loading ? (
              <tr>
                <td colSpan={7} className="plan-empty">No assigned tenders found.</td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td colSpan={7} className="plan-empty">Loading assigned tenders...</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
};
