'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { cancelBudgetCommitment, fetchBudgetAppropriations, fetchBudgetCommitments } from '../../services/budgetService';
import type {
  BudgetAppropriationResponse,
  BudgetCommitmentListResponse,
  BudgetCommitmentResponse
} from '../../types/internal';
import { formatCurrency, formatDateTimeShort } from '../../utils/procureUtils';

type Props = {
  token?: string | null;
};

const pageSize = 12;

const getPagingMeta = (page: number, total: number) => {
  if (!total) return 'No records';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}-${end} of ${total}`;
};

export const BudgetCommitmentLedger = ({ token }: Props) => {
  const [appropriations, setAppropriations] = useState<BudgetAppropriationResponse[]>([]);
  const [selectedAppropriationId, setSelectedAppropriationId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [items, setItems] = useState<BudgetCommitmentResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const selectedAppropriation = useMemo(
    () => appropriations.find((item) => item.AppropriationId === selectedAppropriationId) ?? null,
    [appropriations, selectedAppropriationId]
  );

  const loadCommitments = async () => {
    if (!token) {
      setItems([]);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response: BudgetCommitmentListResponse = await fetchBudgetCommitments(token, {
        appropriationId: selectedAppropriationId || undefined,
        status: selectedStatus || undefined,
        page,
        pageSize
      });
      setItems(response.Items);
      setTotal(response.Total);
    } catch (loadError) {
      setItems([]);
      setTotal(0);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load commitment history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setAppropriations([]);
      return;
    }

    let isMounted = true;
    fetchBudgetAppropriations(token, { status: 'Active', page: 1, pageSize: 100 })
      .then((response) => {
        if (isMounted) {
          setAppropriations(response.Items);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAppropriations([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    void loadCommitments();
  }, [page, selectedAppropriationId, selectedStatus, token]);

  const handleExport = () => {
    if (!items.length) return;

    const headers = ["Commit Date", "Commitment Code", "Description", "Beneficiary", "Release ID", "Amount", "Status"];
    const rows = items.map(item => [
      formatDateTimeShort(item.CreatedAt),
      item.CommitmentCode,
      item.Description,
      item.Beneficiary ?? '',
      item.ReleaseId,
      item.Amount,
      item.Status
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `budget_commitments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCancel = async (item: BudgetCommitmentResponse) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to cancel the commitment of ${formatCurrency(item.Amount)} for ${item.CommitmentCode}?`)) return;

    setCancellingId(item.CommitmentId);
    setError(null);
    setSuccess(null);

    try {
      await cancelBudgetCommitment(token, item.CommitmentId);
      setSuccess(`Commitment for ${item.CommitmentCode} cancelled successfully.`);
      await loadCommitments();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel commitment.');
    } finally {
      setCancellingId(null);
    }
  };

  const statusOptions = [
    { value: '', label: 'All status' },
    { value: 'Committed', label: 'Committed' },
    { value: 'Cancelled', label: 'Cancelled' }
  ];

  if (!token) {
    return (
      <section>
        <div className="budget-card p-12 text-center">
          <h4 className="text-xl font-bold text-slate-900 mb-2">Sign in required</h4>
          <p className="text-slate-500 max-w-md mx-auto">Authentication is required to view commitment history.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="budget-card p-6">
        <div className="plan-filters grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <label className="plan-field lg:col-span-2">
            <span className="text-xs uppercase tracking-wide font-bold text-slate-500">Appropriation</span>
            <select
              className="plan-select w-full"
              value={selectedAppropriationId}
              onChange={(event) => {
                setSelectedAppropriationId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All appropriations</option>
              {appropriations.map((item) => (
                <option key={item.AppropriationId} value={item.AppropriationId}>
                  {item.AppropriationCode} - {item.Description} - FY {item.FiscalYear}
                </option>
              ))}
            </select>
          </label>

          <label className="plan-field">
            <span className="text-xs uppercase tracking-wide font-bold text-slate-500">Status</span>
            <select
              className="plan-select w-full"
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value);
                setPage(1);
              }}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2 h-[42px]">
            <button
              className="plan-button plan-button--secondary flex-1 px-4"
              onClick={() => {
                setSelectedAppropriationId('');
                setSelectedStatus('');
                setPage(1);
              }}
            >
              Clear
            </button>
            <button
              className="plan-button flex-1 px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleExport}
              disabled={!items.length}
            >
              Export CSV
            </button>
          </div>
        </div>

        {selectedAppropriation ? (
          <div className="plan-loading" style={{ marginTop: '16px' }}>
            Viewing commitments for {selectedAppropriation.AppropriationCode}.
          </div>
        ) : null}
      </div>

      {error ? <div className="portal-alert p-4 rounded-2xl border-l-4 border-red-400 mb-4">{error}</div> : null}
      {success ? <div className="portal-alert p-4 rounded-2xl border-l-4 border-green-400 mb-4">{success}</div> : null}

      {isLoading ? (
        <div className="budget-card p-20 text-center">
          <div className="plan-loading inline-block">Loading commitment history...</div>
        </div>
      ) : items.length ? (
        <>
          <div className="budget-table-modern">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                  <th className="p-4 font-semibold text-left">Commit Date</th>
                  <th className="p-4 font-semibold text-left">Commitment Code</th>
                  <th className="p-4 font-semibold text-left">Description</th>
                  <th className="p-4 font-semibold text-left">Beneficiary</th>
                  <th className="p-4 font-semibold text-left">Release ID</th>
                  <th className="p-4 font-semibold text-right">Amount</th>
                  <th className="p-4 font-semibold text-left">Status</th>
                  <th className="p-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.CommitmentId} className="border-b border-slate-100 hover:bg-slate-50 even:bg-slate-50/50">
                    <td className="p-4 text-sm text-slate-700">{formatDateTimeShort(item.CreatedAt)}</td>
                    <td className="p-4 font-mono text-slate-800">{item.CommitmentCode}</td>
                    <td className="p-4 font-medium text-slate-700">{item.Description || '—'}</td>
                    <td className="p-4 text-sm font-semibold text-slate-800">{item.Beneficiary || '—'}</td>
                    <td className="p-4 text-sm text-slate-600">{item.ReleaseId || '—'}</td>
                    <td className="p-4 text-right font-semibold text-amber-800">{formatCurrency(item.Amount)}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                        item.Status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.Status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {(item.Status === 'Committed' || item.Status === 'Reserved') && (
                        <button
                          type="button"
                          className="plan-button plan-button--secondary px-3 py-1 text-xs text-red-600 hover:bg-red-50 border-red-200"
                          disabled={cancellingId === item.CommitmentId}
                          onClick={() => handleCancel(item)}
                        >
                          {cancellingId === item.CommitmentId ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-6">
            <div className="flex gap-4">
              <span className="text-sm text-slate-500">{items.length} records in view</span>
              <span className="text-sm text-slate-600 font-medium">{getPagingMeta(page, total)}</span>
            </div>
            <div className="flex gap-2">
              <button
                className="plan-button plan-button--secondary px-6 py-2"
                onClick={() => setPage(Math.max(page - 1, 1))}
                disabled={page <= 1 || isLoading}
              >
                Previous
              </button>
              <button
                className="plan-button px-6 py-2"
                onClick={() => setPage(page + 1)}
                disabled={page * pageSize >= total || isLoading}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="budget-card p-20 text-center">
          <h4 className="text-2xl font-bold text-slate-900 mb-3">No commitments found</h4>
          <p className="text-slate-500 max-w-lg mx-auto">No committed funds match the current selection.</p>
        </div>
      )}
    </section>
  );
};
