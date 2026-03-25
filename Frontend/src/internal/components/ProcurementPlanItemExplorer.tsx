import React from 'react';
import type { ProcurementPlanItemDetail } from '../types/internal';
import type { YearlyAppPlanSummary, YearlyAppSummary } from '../services/procurementPlanService';

type Props = {
  yearlyApps: YearlyAppSummary[];
  selectedYearlyAppId: string | null;
  selectedYearlyAppTitle: string | null;
  plans: YearlyAppPlanSummary[];
  selectedPlanId: string | null;
  selectedPlanTitle: string | null;
  planItems: ProcurementPlanItemDetail[];
  loading: boolean;
  onSelectYearlyApp: (yearlyAppId: string) => void;
  onSelectPlan: (planId: string, planTitle: string) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value);

export const ProcurementPlanItemExplorer = ({
  yearlyApps,
  selectedYearlyAppId,
  selectedYearlyAppTitle,
  plans,
  selectedPlanId,
  selectedPlanTitle,
  planItems,
  loading,
  onSelectYearlyApp,
  onSelectPlan
}: Props) => {
  return (
    <div className="app-detail-view">
      {/* Yearly APPs Section */}
      <section className="app-card">
        <div className="app-card__header">
          <div className="app-section-title">
            <span className="app-section-title__icon">📅</span>
            <h3 className="app-section-title__text">Yearly APPs</h3>
            <span className="app-section-title__count">{yearlyApps.length}</span>
          </div>
        </div>
        <p className="app-card__description">Select a yearly APP to view its departmental plans</p>

        <div className="app-table-wrapper">
          <table className="app-table">
            <thead>
              <tr>
                <th>APP Title</th>
                <th>Fiscal Year</th>
                <th>Status</th>
                <th>Plans</th>
                <th>Items</th>
                <th className="app-table__cell--numeric">Total Budget</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {yearlyApps.map((app) => (
                <tr
                  key={app.YearlyAppId}
                  className={`app-table__row ${app.YearlyAppId === selectedYearlyAppId ? 'app-table__row--selected' : ''}`}
                >
                  <td className="app-table__cell app-table__cell--strong">{app.Title}</td>
                  <td className="app-table__cell">{app.FiscalYear}</td>
                  <td className="app-table__cell">
                    <span className={`app-badge app-badge--${app.Status.toLowerCase().replace(' ', '-')}`}>
                      {app.Status}
                    </span>
                  </td>
                  <td className="app-table__cell">{app.PlansCount}</td>
                  <td className="app-table__cell">{app.ItemsCount}</td>
                  <td className="app-table__cell app-table__cell--numeric">{formatCurrency(app.TotalBudget)}</td>
                  <td className="app-table__cell">
                    <button
                      className="app-btn app-btn--sm"
                      onClick={() => onSelectYearlyApp(app.YearlyAppId)}
                    >
                      Open Plans
                    </button>
                  </td>
                </tr>
              ))}
              {yearlyApps.length === 0 && (
                <tr>
                  <td colSpan={7} className="app-table__empty">
                    <div className="app-empty-state app-empty-state--small">
                      <span className="app-empty-state__icon">📋</span>
                      <p>No yearly APPs available</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Departmental Plans Section */}
      <section className="app-card">
        <div className="app-card__header">
          <div className="app-section-title">
            <span className="app-section-title__icon">📁</span>
            <h3 className="app-section-title__text">
              {selectedYearlyAppTitle ? `${selectedYearlyAppTitle} Plans` : 'Departmental Plans'}
            </h3>
            <span className="app-section-title__count">{plans.length}</span>
          </div>
        </div>
        <p className="app-card__description">
          {selectedYearlyAppId
            ? 'Departmental plans within the selected yearly APP'
            : 'Select a yearly APP above to view its plans'}
        </p>

        <div className="app-table-wrapper">
          <table className="app-table">
            <thead>
              <tr>
                <th>Plan Title</th>
                <th>Department</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Items</th>
                <th className="app-table__cell--numeric">Total Budget</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr
                  key={plan.PlanId}
                  className={`app-table__row ${plan.PlanId === selectedPlanId ? 'app-table__row--selected' : ''}`}
                >
                  <td className="app-table__cell app-table__cell--strong">{plan.PlanTitle}</td>
                  <td className="app-table__cell">{plan.Department}</td>
                  <td className="app-table__cell">
                    <span className="app-stage-tag">{plan.CurrentStageTitle || plan.CurrentStageKey || 'Not loaded'}</span>
                  </td>
                  <td className="app-table__cell">
                    <span className={`app-badge app-badge--${plan.Status.toLowerCase()}`}>{plan.Status}</span>
                  </td>
                  <td className="app-table__cell">{plan.ItemCount}</td>
                  <td className="app-table__cell app-table__cell--numeric">{formatCurrency(plan.TotalBudget)}</td>
                  <td className="app-table__cell">
                    <button
                      className="app-btn app-btn--sm app-btn--secondary"
                      onClick={() => onSelectPlan(plan.PlanId, plan.PlanTitle)}
                    >
                      Open Items
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && selectedYearlyAppId && plans.length === 0 && (
                <tr>
                  <td colSpan={7} className="app-table__empty">
                    <div className="app-empty-state app-empty-state--small">
                      <span className="app-empty-state__icon">📭</span>
                      <p>This yearly APP has no departmental plans yet</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !selectedYearlyAppId && (
                <tr>
                  <td colSpan={7} className="app-table__empty">
                    <div className="app-empty-state app-empty-state--small">
                      <span className="app-empty-state__icon">👆</span>
                      <p>Open a yearly APP above to view its plans</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="app-table__empty">
                    <div className="app-empty-state app-empty-state--small">
                      <span className="app-empty-state__icon">⏳</span>
                      <p>Loading plans...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* APP Items Section */}
      <section className="app-card">
        <div className="app-card__header">
          <div className="app-section-title">
            <span className="app-section-title__icon">📦</span>
            <h3 className="app-section-title__text">
              {selectedPlanTitle ? `${selectedPlanTitle} Items` : 'APP Items'}
            </h3>
            <span className="app-section-title__count">{planItems.length}</span>
          </div>
        </div>
        <p className="app-card__description">
          {selectedPlanId
            ? 'Items generated from requisitions that passed planning committee review'
            : 'Select a plan above to view its APP items'}
        </p>

        <div className="app-table-wrapper">
          <table className="app-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Budget Code</th>
                <th>Procurement Type</th>
                <th className="app-table__cell--numeric">Estimated Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {planItems.map((item) => (
                <tr key={item.PlanItemId} className="app-table__row">
                  <td className="app-table__cell app-table__cell--mono">{item.ItemCode || 'N/A'}</td>
                  <td className="app-table__cell">{item.Description}</td>
                  <td className="app-table__cell app-table__cell--mono">{item.BudgetCode}</td>
                  <td className="app-table__cell">{item.ProcurementType || 'Not stated'}</td>
                  <td className="app-table__cell app-table__cell--numeric">
                    {formatCurrency(item.EstimatedAmount)}
                  </td>
                  <td className="app-table__cell">
                    <span className={`app-badge app-badge--${item.Status.toLowerCase()}`}>{item.Status}</span>
                  </td>
                </tr>
              ))}
              {!loading && selectedPlanId && planItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="app-table__empty">
                    <div className="app-empty-state app-empty-state--small">
                      <span className="app-empty-state__icon">📭</span>
                      <p>This departmental plan has no generated items yet</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !selectedPlanId && (
                <tr>
                  <td colSpan={6} className="app-table__empty">
                    <div className="app-empty-state app-empty-state--small">
                      <span className="app-empty-state__icon">👆</span>
                      <p>Open a plan above to view its APP items</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="app-table__empty">
                    <div className="app-empty-state app-empty-state--small">
                      <span className="app-empty-state__icon">⏳</span>
                      <p>Loading APP items...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
