'use client';

import { useState } from 'react';
import type { BudgetConfirmationDetail } from '../../types/internal';
import { formatCurrency, formatDate, formatDateTimeShort, toTitle, getVarianceColor } from '../../utils/procureUtils';
import { WorkflowProgressStepper } from '../WorkflowProgressStepper';
import type { WorkflowRuntimeDisplay } from '../workflowDisplayTypes';

type Props = {
  detail: BudgetConfirmationDetail | null;
  isLoading: boolean;
};

type BudgetConfirmationDetailWithDisplay = BudgetConfirmationDetail & {
  WorkflowDisplay?: WorkflowRuntimeDisplay | null;
};

const getStatusTone = (value?: string | null): string => {
  switch ((value || '').toLowerCase()) {
    case 'budget confirmed':
    case 'approved':
      return 'admin-status admin-status--good';
    case 'on hold':
    case 'returned':
      return 'admin-status admin-status--warn';
    case 'rejected':
      return 'admin-status admin-status--alert';
    default:
      return 'admin-status';
  }
};

type TabKey = 'summary' | 'budget-lines' | 'items' | 'history';

export const BudgetDetailView = ({ detail, isLoading }: Props) => {
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const detailWithDisplay = detail as BudgetConfirmationDetailWithDisplay | null;

  if (isLoading) {
    return (
      <section className="budget-workspace__detail">
        <div className="plan-loading text-center py-12">Loading plan details...</div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="budget-workspace__detail">
        <div className="budget-card p-16 text-center">
          <div className="text-5xl mb-4 opacity-50">📋</div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Select Plan</h3>
          <p className="text-slate-500 max-w-md mx-auto">Choose a requisition from the queue to view detailed budget analysis.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="budget-workspace__detail space-y-8">
      <div className="budget-card p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="admin-kicker bg-blue-100 text-blue-800 px-3 py-1 rounded-full inline-block text-sm font-bold">
              Plan ID: {detail.PlanId.split('-')[0].toUpperCase()}
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold mt-2 leading-tight">{detail.PlanTitle}</h2>
            <div className="flex flex-wrap gap-3 mt-4 text-sm">
              <span className="req-badge">{detail.CurrentStageTitle}</span>
              <span className="req-badge req-badge--soft">{detail.PlanStatus}</span>
              <span className={getStatusTone(detail.WorkflowStatus ?? detail.PlanStatus)}>
                {detail.WorkflowStatus ?? detail.PlanStatus}
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full font-medium">
                FY {detail.FiscalYear} • {detail.ItemCount} items
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold variance-positive">{formatCurrency(detail.Available)}</div>
              <div className="text-sm text-slate-500 uppercase tracking-wide">Available</div>
            </div>
            <WorkflowProgressStepper currentStageKey={detail.CurrentStageKey} display={detailWithDisplay?.WorkflowDisplay} />
          </div>
        </div>
      </div>

      <div className="budget-card p-1">
        <div className="flex bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl overflow-hidden border">
          {([
            { key: 'summary' as TabKey, label: 'Summary', icon: '📋' },
            { key: 'budget-lines' as TabKey, label: 'Budget Lines', icon: '💰', count: detail.BudgetLines.length },
            { key: 'items' as TabKey, label: 'Items', icon: '🗂️', count: detail.PlanItems.length },
            { key: 'history' as TabKey, label: 'History', icon: '📜', count: detail.History.length }
          ] as Array<{ key: TabKey; label: string; icon: string; count?: number }>).map((tab) => (
            <button
              key={tab.key}
              className={`flex items-center gap-2 px-6 py-4 flex-1 text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-white shadow-sm border-b-2 border-blue-500 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'summary' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="budget-card p-8">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-slate-600 mb-6 flex items-center gap-2">
                    💱 Budget Position
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                      <span className="text-xs uppercase tracking-wide text-slate-500 block mb-1">Requested</span>
                      <strong className="text-2xl font-bold">{formatCurrency(detail.RequestedAmount)}</strong>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide text-slate-500 block mb-1">Appropriated</span>
                      <strong className="text-2xl font-bold text-green-600">{formatCurrency(detail.Appropriated)}</strong>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide text-slate-500 block mb-1">Committed</span>
                      <strong className="text-2xl font-bold text-amber-700">{formatCurrency(detail.Committed)}</strong>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide text-slate-500 block mb-1">Available</span>
                      <strong className={`text-2xl font-bold ${getVarianceColor(detail.Variance)}`}>
                        {formatCurrency(detail.Available)}
                      </strong>
                    </div>
                    <div className="md:col-span-3">
                      <span className="text-xs uppercase tracking-wide text-slate-500 block mb-2">Variance</span>
                      <div className="variance-bar h-3">
                        <div className={`variance-fill h-full ${getVarianceColor(detail.Variance)}`} style={{ width: '65%' }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="budget-card p-8">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-slate-600 mb-6 flex items-center gap-2">
                    📎 Plan Details
                  </h4>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-slate-500">Total Budget</dt>
                      <dd className="font-semibold">{formatCurrency(detail.TotalBudget)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Created</dt>
                      <dd className="font-semibold">{formatDate(detail.CreatedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Updated</dt>
                      <dd>{formatDateTimeShort(detail.UpdatedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Stage</dt>
                      <dd className="font-semibold">{detail.CurrentStageTitle}</dd>
                    </div>
                  </dl>
                  {detail.Notes && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <h5 className="font-semibold mb-3">Notes</h5>
                      <p className="text-slate-700 leading-relaxed">{detail.Notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'budget-lines' && detail.BudgetLines.length > 0 && (
            <div className="budget-table-modern">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                    <th className="p-4 text-left font-semibold">Code</th>
                    <th className="p-4 text-left font-semibold">Items</th>
                    <th className="p-4 text-right font-semibold">Requested</th>
                    <th className="p-4 text-right font-semibold">Available</th>
                    <th className="p-4 text-right font-semibold">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.BudgetLines.map((line) => (
                    <tr key={line.BudgetCode} className="hover:bg-slate-50 border-b border-slate-100">
                      <td className="p-4 font-mono bg-slate-50">
                        <code>{line.BudgetCode}</code>
                      </td>
                      <td className="p-4">{line.ItemCount}</td>
                      <td className="p-4 text-right font-semibold">{formatCurrency(line.RequestedAmount)}</td>
                      <td className="p-4 text-right text-green-600 font-semibold">{formatCurrency(line.Available)}</td>
                      <td className="p-4 text-right font-semibold text-red-600">{formatCurrency(line.Variance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'items' && detail.PlanItems.length > 0 && (
            <div className="budget-table-modern">
              <table>
                <thead>
                  <tr className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
                    <th className="p-4 text-left font-semibold">Description</th>
                    <th className="p-4 text-left font-semibold">Code</th>
                    <th className="p-4 text-left font-semibold">Type</th>
                    <th className="p-4 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.PlanItems.map((item) => (
                    <tr key={item.PlanItemId} className="hover:bg-slate-50 border-b">
                      <td className="p-4">
                        <div className="font-semibold">{item.Description}</div>
                        <div className="text-sm text-slate-500">{item.ItemCode || 'No code'}</div>
                      </td>
                      <td className="p-4">
                        <code className="plan-code">{item.BudgetCode}</code>
                      </td>
                      <td className="p-4">{item.ProcurementType || '—'}</td>
                      <td className="p-4 text-right font-semibold">{formatCurrency(item.EstimatedAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {detail.History.length > 0 ? (
                detail.History.map((entry) => (
                  <div key={entry.HistoryId} className="budget-card p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h5 className="font-bold text-lg">{entry.ToStageTitle}</h5>
                      <span className="text-sm text-slate-500">{formatDateTimeShort(entry.CreatedAt)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      By: <strong>{entry.Actor || 'System'}</strong> • {entry.StageStatus || toTitle(entry.ToStageKey)}
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl text-sm leading-relaxed">
                      {entry.TransitionReason || 'No note recorded'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500">No history available</div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
