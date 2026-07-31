'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchBudgetAppropriations, fetchBudgetCommitments, fetchBudgetReleases } from '../../services/budgetService';
import type {
  BudgetAppropriationResponse,
  BudgetReleaseListResponse,
  BudgetReleaseResponse
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

const escapeCsvValue = (value: string | number | null | undefined) => {
  const normalized = value == null ? '' : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
};

export const BudgetReleaseLedger = ({ token }: Props) => {
  const [appropriations, setAppropriations] = useState<BudgetAppropriationResponse[]>([]);
  const [selectedAppropriationId, setSelectedAppropriationId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [items, setItems] = useState<BudgetReleaseResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAppropriation = useMemo(
    () => appropriations.find((item) => item.AppropriationId === selectedAppropriationId) ?? null,
    [appropriations, selectedAppropriationId]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const releaseTime = new Date(item.CreatedAt).getTime();
      if (Number.isNaN(releaseTime)) {
        return false;
      }

      if (fromDate) {
        const startTime = new Date(`${fromDate}T00:00:00`).getTime();
        if (!Number.isNaN(startTime) && releaseTime < startTime) {
          return false;
        }
      }

      if (toDate) {
        const endTime = new Date(`${toDate}T23:59:59`).getTime();
        if (!Number.isNaN(endTime) && releaseTime > endTime) {
          return false;
        }
      }

      return true;
    });
  }, [fromDate, items, toDate]);

  const handleExportCsv = async () => {
    if (!token) return;
    const commitmentResponse = await fetchBudgetCommitments(token, {
      appropriationId: selectedAppropriationId || undefined,
      page: 1,
      pageSize: 100
    });

    const releaseRows = filteredItems.map((item) => [
      'Release',
      item.ReleaseId,
      item.CreatedAt,
      '',
      '',
      item.ReleaseCode,
      '',
      item.Amount,
      item.Description ?? ''
    ]);
    const commitmentRows = commitmentResponse.Items.map((item) => [
      'Commitment',
      item.CommitmentId,
      item.CreatedAt,
      '',
      '',
      item.CommitmentCode,
      '',
      item.Amount,
      item.Status
    ]);

    const csv = [
      ['Type', 'Record ID', 'Date', 'Fiscal Year', 'Department', 'Budget Code', 'Appropriation Amount', 'Amount', 'Notes/Status'],
      ...releaseRows,
      ...commitmentRows
    ]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'budget-release-commitment-history.csv';
    link.click();
    URL.revokeObjectURL(url);
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
    if (!token) {
      setItems([]);
      setTotal(0);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchBudgetReleases(token, {
      appropriationId: selectedAppropriationId || undefined,
      page,
      pageSize
    })
      .then((response: BudgetReleaseListResponse) => {
        if (!isMounted) return;
        setItems(response.Items);
        setTotal(response.TotalCount);
      })
      .catch((loadError) => {
        if (!isMounted) return;
        setItems([]);
        setTotal(0);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release history.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [page, selectedAppropriationId, token]);

  if (!token) {
    return (
      <section>
        <div className="view-header">
          <h3 className="text-2xl font-bold">Ledger History</h3>
          <p className="text-slate-600 mt-2">View all released budget entries</p>
        </div>
        <div className="budget-card p-12 text-center">
          <h4 className="text-xl font-bold text-slate-900 mb-2">Sign in required</h4>
          <p className="text-slate-500 max-w-md mx-auto">Access to released budget history requires authentication.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">

      <div className="budget-card p-6">
        <div className="plan-filters grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-4 items-end">
          <label className="plan-field">
            <span className="text-xs uppercase tracking-wide font-bold text-slate-500">Appropriation</span>
            <select
              className="plan-select w-full"
              value={selectedAppropriationId}
              onChange={(event) => {
                setPage(1);
                setSelectedAppropriationId(event.target.value);
              }}
            >
              <option value="">All appropriations</option>
              {appropriations.map((item) => (
                <option key={item.AppropriationId} value={item.AppropriationId}>
                  {item.AppropriationCode} - FY {item.FiscalYear}
                </option>
              ))}
            </select>
          </label>

          <label className="plan-field">
            <span className="text-xs uppercase tracking-wide font-bold text-slate-500">From Date</span>
            <input
              className="plan-input w-full"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>

          <label className="plan-field">
            <span className="text-xs uppercase tracking-wide font-bold text-slate-500">To Date</span>
            <input
              className="plan-input w-full"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="plan-button plan-button--secondary px-6"
            onClick={() => {
              setSelectedAppropriationId('');
              setFromDate('');
              setToDate('');
              setPage(1);
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="plan-button plan-button--secondary px-6"
            onClick={handleExportCsv}
            disabled={!filteredItems.length}
          >
            Export CSV
          </button>
        </div>

        {selectedAppropriation ? (
          <div className="plan-loading" style={{ marginTop: '16px' }}>
            Viewing releases for {selectedAppropriation.AppropriationCode} - {selectedAppropriation.Description}.
          </div>
        ) : null}
      </div>

      {error ? <div className="portal-alert p-4 rounded-2xl border-l-4 border-red-400">{error}</div> : null}

      {isLoading ? (
        <div className="budget-card p-20 text-center">
          <div className="plan-loading inline-block">Loading ledger history...</div>
        </div>
      ) : filteredItems.length ? (
        <>
          <div className="budget-table-modern" style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ minWidth: 980 }}>
              <thead>
                <tr className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                  <th className="p-4 font-semibold rounded-tl-xl text-left">Release Date</th>
                  <th className="p-4 font-semibold text-left">Release Code</th>
                  <th className="p-4 font-semibold text-left">Description</th>
                  <th className="p-4 font-semibold text-right">Amount</th>
                  <th className="p-4 font-semibold text-left rounded-tr-xl">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.ReleaseId} className="hover:bg-slate-50 border-b border-slate-100 even:bg-slate-50/50">
                    <td className="p-4">
                      <div className="text-sm font-semibold text-slate-800">{formatDateTimeShort(item.CreatedAt)}</div>
                    </td>
                    <td className="p-4">
                      <code className="plan-code bg-emerald-50 text-emerald-800 px-3 py-2 rounded-xl font-semibold">
                        {item.ReleaseCode}
                      </code>
                    </td>
                    <td className="p-4 font-medium text-slate-700">{item.Description || '—'}</td>
                    <td className="p-4 text-right">
                      <div className="text-lg font-bold text-emerald-700">{formatCurrency(item.Amount)}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                        item.Status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {item.Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-6">
            <span className="text-sm text-slate-600 font-medium">
              {fromDate || toDate ? `${filteredItems.length} filtered record(s)` : getPagingMeta(page, total)}
            </span>
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
          <h4 className="text-2xl font-bold text-slate-900 mb-3">No releases found</h4>
          <p className="text-slate-500 max-w-lg mx-auto">No released budget records match the current selection.</p>
        </div>
      )}
    </section>
  );
};
