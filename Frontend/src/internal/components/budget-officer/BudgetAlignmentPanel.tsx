'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchBudgetAppropriations, fetchBudgetAvailability, fetchBudgetSummary } from '../../services/budgetService';
import { fetchRequisitionDetail } from '../../services/requisitionService';
import { updateRequisition } from '../../services/requisitionService';
import type {
  BudgetAppropriationResponse,
  BudgetAvailabilityResponse,
  BudgetSummaryResponse,
  BudgetRequisitionQueueItem,
  RequisitionDetail
} from '../../types/internal';

type AlignmentStatus = {
  type: 'success' | 'error';
  message: string;
};

type Props = {
  token?: string | null;
  requisition: BudgetRequisitionQueueItem | null;
  onAligned?: () => void;
  onClose?: () => void;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });

const deriveFiscalYear = (requiredBy?: string | null) => {
  if (!requiredBy) {
    return new Date().getUTCFullYear();
  }
  const parsed = Date.parse(requiredBy);
  return Number.isFinite(parsed) ? new Date(parsed).getUTCFullYear() : new Date().getUTCFullYear();
};

export const BudgetAlignmentPanel = ({ token, requisition, onAligned, onClose }: Props) => {
  const [budgetCode, setBudgetCode] = useState('');
  const [budgetOptions, setBudgetOptions] = useState<BudgetAppropriationResponse[]>([]);
  const [requisitionDetail, setRequisitionDetail] = useState<RequisitionDetail | null>(null);
  const [availability, setAvailability] = useState<BudgetAvailabilityResponse | null>(null);
  const [summary, setSummary] = useState<BudgetSummaryResponse | null>(null);
  const [status, setStatus] = useState<AlignmentStatus | null>(null);
  const [isLoadingRequisitionDetail, setIsLoadingRequisitionDetail] = useState(false);
  const [isLoadingBudgetCodes, setIsLoadingBudgetCodes] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fiscalYear = useMemo(() => deriveFiscalYear(requisition?.RequiredBy), [requisition]);

  useEffect(() => {
    setBudgetCode(requisition?.BudgetCode ?? '');
    setBudgetOptions([]);
    setRequisitionDetail(null);
    setAvailability(null);
    setSummary(null);
    setStatus(null);
  }, [requisition]);

  useEffect(() => {
    if (!token || !requisition) {
      setRequisitionDetail(null);
      return;
    }

    let isMounted = true;
    setIsLoadingRequisitionDetail(true);

    fetchRequisitionDetail(token, requisition.RequisitionId)
      .then((detail) => {
        if (isMounted) {
          setRequisitionDetail(detail);
        }
      })
      .catch(() => {
        if (isMounted) {
          setRequisitionDetail(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingRequisitionDetail(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, requisition]);

  useEffect(() => {
    if (!token || !requisition) {
      setBudgetOptions([]);
      return;
    }

    let isMounted = true;
    setIsLoadingBudgetCodes(true);

    fetchBudgetAppropriations(token, {
      fiscalYear,
      department: requisition.Department,
      status: 'Active',
      page: 1,
      pageSize: 100
    })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        const nextOptions = response.Items;
        setBudgetOptions(nextOptions);

        if (!budgetCode && nextOptions.length === 1) {
          setBudgetCode(nextOptions[0].BudgetCode);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBudgetOptions([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingBudgetCodes(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, requisition, fiscalYear, budgetCode]);

  const canAlign = Boolean(token && requisition && budgetCode.trim());

  const handleCheckBudget = useCallback(async () => {
    if (!token || !requisition) {
      setStatus({ type: 'error', message: 'Sign in and select a requisition before checking budgets.' });
      return;
    }

    if (!budgetCode.trim()) {
      setStatus({ type: 'error', message: 'Enter a budget code to fetch availability.' });
      return;
    }

    setIsChecking(true);
    setStatus(null);
    try {
      const availabilityResult = await fetchBudgetAvailability(token, {
        budgetCode: budgetCode.trim(),
        department: requisition.Department,
        fiscalYear
      });
      const summaryResult = await fetchBudgetSummary(token, {
        budgetCode: budgetCode.trim(),
        department: requisition.Department,
        fiscalYear
      });
      setAvailability(availabilityResult);
      setSummary(summaryResult);
      setStatus(null);
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to fetch budget availability for that code.'
      });
      setAvailability(null);
      setSummary(null);
    } finally {
      setIsChecking(false);
    }
  }, [token, requisition, budgetCode, fiscalYear]);

  const handleAlignBudget = async () => {
    if (!canAlign || !requisition || !token) {
      setStatus({ type: 'error', message: 'Select a requisition and provide a budget code to align.' });
      return;
    }

    setIsSaving(true);
    setStatus(null);
    try {
      await updateRequisition(token, requisition.RequisitionId, {
        BudgetCode: budgetCode.trim(),
        Status: 'Initial'
      });
      setStatus({
        type: 'success',
        message: 'Budget code allocated and committed. The requisition is ready for Comptroller Procurement Review.'
      });
      onAligned?.();
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to align this requisition to funding at the moment.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="budget-alignment-panel">
      <header>
        <div>
          <p className="admin-kicker">Endorsed requisitions</p>
          <h3>Budget alignment terminal</h3>
          <p className="plan-muted">
            Only budget-aligned requisitions move to the planning committee. Assign a code, verify funds, and
            confirm once satisfied.
          </p>
        </div>
        {onClose ? (
          <button type="button" className="budget-alignment-panel__close" onClick={onClose} aria-label="Close budget alignment">
            ×
          </button>
        ) : null}
      </header>

      {requisition ? (
        <>
          <div className="budget-alignment-panel__summary">
            <p className="plan-muted">Requisition</p>
            <strong>{requisition.Title}</strong>
            <div className="budget-alignment-panel__meta">
              <span>{requisition.Department}</span>
              <span>{requisition.CurrentStageTitle}</span>
              <span>{formatCurrency(requisition.TotalEstimate)}</span>
            </div>
          </div>

          <section className="budget-alignment-panel__detail-block">
            <div className="budget-alignment-panel__detail-header">
              <h4>Requisition Details</h4>
              {isLoadingRequisitionDetail ? <span className="plan-muted">Loading full requisition...</span> : null}
            </div>

            {requisitionDetail ? (
              <>
                <div className="budget-alignment-panel__detail-grid">
                  <div>
                    <span>Title</span>
                    <strong>{requisitionDetail.Title}</strong>
                  </div>
                  <div>
                    <span>Department</span>
                    <strong>{requisitionDetail.Department}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{requisitionDetail.Status}</strong>
                  </div>
                  <div>
                    <span>Current Stage</span>
                    <strong>{requisitionDetail.CurrentStage || 'Not set'}</strong>
                  </div>
                  <div>
                    <span>Procurement Type</span>
                    <strong>{requisitionDetail.ProcurementType || 'Not stated'}</strong>
                  </div>
                  <div>
                    <span>Priority</span>
                    <strong>{requisitionDetail.Priority || 'Normal'}</strong>
                  </div>
                  <div>
                    <span>Funding Source</span>
                    <strong>{requisitionDetail.FundingSource || 'Not stated'}</strong>
                  </div>
                  <div>
                    <span>Required By</span>
                    <strong>{requisitionDetail.RequiredBy ? new Date(requisitionDetail.RequiredBy).toLocaleDateString() : 'Not set'}</strong>
                  </div>
                  <div>
                    <span>Delivery Location</span>
                    <strong>{requisitionDetail.DeliveryLocation || 'Not stated'}</strong>
                  </div>
                  <div>
                    <span>Total Estimate</span>
                    <strong>{formatCurrency(requisitionDetail.TotalEstimate)}</strong>
                  </div>
                </div>

                {requisitionDetail.Justification ? (
                  <div className="budget-alignment-panel__detail-note">
                    <span>Justification</span>
                    <p>{requisitionDetail.Justification}</p>
                  </div>
                ) : null}

                {requisitionDetail.RiskNotes ? (
                  <div className="budget-alignment-panel__detail-note">
                    <span>Risk Notes</span>
                    <p>{requisitionDetail.RiskNotes}</p>
                  </div>
                ) : null}

                <div className="budget-alignment-panel__line-items">
                  <div className="budget-alignment-panel__detail-header">
                    <h4>Line Items</h4>
                    <span className="plan-muted">{requisitionDetail.LineItems.length} item(s)</span>
                  </div>
                  <div className="budget-alignment-panel__line-items-table">
                    <table className="plan-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Unit</th>
                          <th>Qty</th>
                          <th>Unit Cost</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requisitionDetail.LineItems.map((item, index) => (
                          <tr key={`${item.ItemId ?? 'item'}-${index}`}>
                            <td>{item.Description}</td>
                            <td>{item.Unit}</td>
                            <td>{item.Quantity}</td>
                            <td>{formatCurrency(item.UnitCost)}</td>
                            <td>{formatCurrency(item.Quantity * item.UnitCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="plan-empty">Full requisition details are not available yet.</div>
            )}
          </section>

          <div className="budget-alignment-panel__form">
            <label className="budget-alignment-panel__budget-code-field">
              <span>Budget code</span>
              <select
                className="plan-select"
                value={budgetCode}
                onChange={(event) => setBudgetCode(event.target.value)}
                disabled={!token || isLoadingBudgetCodes || !budgetOptions.length}
              >
                <option value="">
                  {isLoadingBudgetCodes
                    ? 'Loading budget codes...'
                    : budgetOptions.length
                      ? 'Select budget code'
                      : 'No budget codes found'}
                </option>
                {budgetOptions.map((option) => (
                  <option key={option.AppropriationId} value={option.BudgetCode}>
                    {option.BudgetCode} - {formatCurrency(option.Amount)}
                  </option>
                ))}
              </select>
            </label>

            <div className="budget-alignment-panel__buttons">
              <button
                type="button"
                className="plan-button plan-button--secondary"
                onClick={handleCheckBudget}
                disabled={isChecking || !budgetCode.trim() || !token}
              >
                {isChecking ? 'Checking availability…' : 'Fetch budget line'}
              </button>

              <button
                type="button"
                className="plan-button plan-button--primary"
                onClick={handleAlignBudget}
                disabled={!canAlign || isSaving}
              >
                {isSaving ? 'Aligning requisition…' : 'Align and lock budget'}
              </button>
            </div>

            {status && (
              <div
                className={`portal-alert ${
                  status.type === 'success' ? 'portal-alert--success' : 'portal-alert--error'
                }`}
              >
                {status.message}
              </div>
            )}
          </div>

          {(availability || summary) && (
            <div className="budget-alignment-panel__budget-data">
              {availability && (
                <div>
                  <p className="plan-muted">Current availability</p>
                  <strong>{formatCurrency(availability.Available)}</strong>
                </div>
              )}
              {summary && (
                <div>
                  <p className="plan-muted">Budget snapshot</p>
                  <ul>
                    <li>Appropriated: {formatCurrency(summary.Appropriated)}</li>
                    <li>Released: {formatCurrency(summary.Released)}</li>
                    <li>Committed: {formatCurrency(summary.Committed)}</li>
                    <li>Spent: {formatCurrency(summary.Spent)}</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="plan-empty">
          Select an endorsed requisition on the left to assign a budget line and confirm funding readiness.
        </div>
      )}

      <style jsx>{`
        .budget-alignment-panel {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid var(--portal-border);
          border-radius: 20px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100%;
        }

        header h3 {
          margin-bottom: 4px;
        }

        header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .budget-alignment-panel__close {
          border: none;
          background: rgba(148, 163, 184, 0.16);
          color: var(--portal-ink);
          width: 40px;
          height: 40px;
          border-radius: 999px;
          font-size: 1.6rem;
          line-height: 1;
          cursor: pointer;
          flex-shrink: 0;
        }

        .budget-alignment-panel__summary {
          border-bottom: 1px solid var(--portal-border);
          padding-bottom: 12px;
        }

        .budget-alignment-panel__detail-block {
          border: 1px solid var(--portal-border);
          border-radius: 18px;
          padding: 16px;
          background: rgba(248, 250, 252, 0.86);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .budget-alignment-panel__detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .budget-alignment-panel__detail-header h4 {
          margin: 0;
        }

        .budget-alignment-panel__detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px 16px;
        }

        .budget-alignment-panel__detail-grid span,
        .budget-alignment-panel__detail-note span {
          display: block;
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
          margin-bottom: 4px;
        }

        .budget-alignment-panel__detail-grid strong {
          color: #0f172a;
        }

        .budget-alignment-panel__detail-note {
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.9);
        }

        .budget-alignment-panel__detail-note p {
          margin: 0;
          color: #0f172a;
        }

        .budget-alignment-panel__line-items {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .budget-alignment-panel__line-items-table {
          overflow-x: auto;
          background: rgba(255, 255, 255, 0.94);
          border-radius: 14px;
        }

        .budget-alignment-panel__meta {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 0.875rem;
          color: var(--portal-slate);
        }

        .budget-alignment-panel__form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .budget-alignment-panel__form label span {
          font-size: 0.825rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--portal-slate);
          display: block;
          margin-bottom: 8px;
        }

        .budget-alignment-panel__budget-code-field {
          margin-left: 0;
        }

        .budget-alignment-panel__buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .budget-alignment-panel__budget-data {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
          border-top: 1px solid var(--portal-border);
          padding-top: 14px;
        }

        .budget-alignment-panel__budget-data strong {
          display: block;
          margin-top: 4px;
        }

        .budget-alignment-panel__budget-data ul {
          margin: 4px 0 0;
          padding-left: 18px;
          color: var(--portal-ink);
        }

        .portal-alert--success {
          background: #dff4e4;
          border-color: #98d7a5;
        }

        .portal-alert--error {
          background: #ffe7e5;
          border-color: #f1a4a3;
        }

        @media (max-width: 720px) {
          .budget-alignment-panel__detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
};
