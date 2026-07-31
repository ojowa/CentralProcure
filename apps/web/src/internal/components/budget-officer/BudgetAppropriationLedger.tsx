'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { BudgetAppropriationResponse, BudgetAppropriationListResponse } from '../../types/internal';
import { closeBudgetAppropriation, fetchBudgetAppropriations } from '../../services/budgetService';
import { formatCurrency, formatDateTimeShort } from '../../utils/procureUtils';

type Filters = {
  fiscalYear: string;
  department: string;
  budgetCode: string;
  status: string;
};

const defaultFilters: Filters = {
  fiscalYear: '',
  department: '',
  budgetCode: '',
  status: ''
};

const pageSize = 12;

const getPagingMeta = (page: number, total: number) => {
  if (!total) return 'No records';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}-${end} of ${total}`;
};

export const BudgetAppropriationLedger = ({ token }: { token?: string | null }) => {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BudgetAppropriationResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const fiscalYearValue = Number(filters.fiscalYear);

  const loadLedger = async () => {
    if (!token) {
      setItems([]);
      setTotal(0);
      setSuccess(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response: BudgetAppropriationListResponse = await fetchBudgetAppropriations(token, {
        fiscalYear: Number.isFinite(fiscalYearValue) && fiscalYearValue > 0 ? fiscalYearValue : undefined,
        department: filters.department || undefined,
        budgetCode: filters.budgetCode || undefined,
        status: filters.status || undefined,
        page,
        pageSize
      });

      setItems(response.Items);
      setTotal(response.TotalCount);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load appropriation ledger.'
      );
      setItems([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLedger();
  }, [token, filters, page]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const statusOptions = useMemo(
    () => [
      { value: '', label: 'Any status' },
      { value: 'Active', label: 'Active' },
      { value: 'Closed', label: 'Closed' }
    ],
    []
  );

  // CSV Export Handler
  const handleExport = () => {
    if (!items.length) return;

    const headers = ["Fiscal Year", "Appropriation Code", "Description", "Total Amount", "Status", "Created At"];
    const rows = items.map(item => [
      item.FiscalYear,
      `"${item.AppropriationCode}"`,
      `"${item.Description}"`,
      item.TotalAmount,
      item.Status,
      item.CreatedAt
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `appropriation_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!token) {
    return (
      <section>
        <div className="view-header">
          <h3 className="text-2xl font-bold">Appropriation Ledger</h3>
          <p className="text-slate-600 mt-2">Agency-wide budget appropriations register</p>
        </div>
        <div className="budget-card p-12 text-center">
          <svg className="w-20 h-20 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h4 className="text-xl font-bold text-slate-900 mb-2">Sign in required</h4>
          <p className="text-slate-500 max-w-md mx-auto">Access to the full appropriation ledger requires authentication.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="budget-card p-6">
        <div className="plan-filters grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <label className="plan-field">
            <span className="text-xs uppercase tracking-wide font-bold text-slate-500">Fiscal Year</span>
            <input
              className="plan-input w-full"
              inputMode="numeric"
              value={filters.fiscalYear}
              onChange={(event) => handleFilterChange('fiscalYear', event.target.value)}
              placeholder="e.g. 2026"
            />
          </label>
          <label className="plan-field">
            <span className="text-xs uppercase tracking-wide font-bold text-slate-500">Department</span>
            <input
              className="plan-input w-full"
              value={filters.department}
              onChange={(event) => handleFilterChange('department', event.target.value)}
              placeholder="e.g. Finance"
            />
          </label>
          <label className="plan-field">
            <span className="text-xs uppercase tracking-wide font-bold text-slate-500">Budget Code</span>
            <input
              className="plan-input w-full"
              value={filters.budgetCode}
              onChange={(event) => handleFilterChange('budgetCode', event.target.value)}
              placeholder="e.g. CAP-2026"
            />
          </label>
          <label className="plan-field">
            <span className="text-xs uppercase tracking-wide font-bold text-slate-500">Status</span>
            <select
              className="plan-select w-full"
              value={filters.status}
              onChange={(event) => handleFilterChange('status', event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 h-[42px]">
            <button
              className="plan-button plan-button--secondary flex-1 px-4"
              onClick={() => {
                setFilters(defaultFilters);
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
      </div>

      {error && (
        <div className="portal-alert p-4 rounded-2xl border-l-4 border-red-400">
          <strong>Load error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="portal-alert p-4 rounded-2xl border-l-4 border-green-400">
          <strong>Success:</strong> {success}
        </div>
      )}

      {isLoading ? (
        <div className="budget-card p-20 text-center">
          <div className="plan-loading inline-block">Loading ledger...</div>
        </div>
      ) : items.length ? (
        <>
          <div className="budget-table-modern">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white">
                  <th className="p-4 font-semibold rounded-tl-xl">Fiscal Year</th>
                  <th className="p-4 font-semibold">Appropriation Code</th>
                  <th className="p-4 font-semibold">Description</th>
                  <th className="p-4 font-semibold text-right">Amount</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Created At</th>
                  <th className="p-4 font-semibold rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.AppropriationId} className="hover:bg-slate-50 border-b border-slate-100 even:bg-slate-50/50">
                    <td className="p-4 font-mono text-lg">{item.FiscalYear}</td>
                    <td className="p-4">
                      <code className="plan-code bg-indigo-50 text-indigo-800 px-3 py-2 rounded-xl font-semibold">{item.AppropriationCode}</code>
                    </td>
                    <td className="p-4 font-medium">{item.Description}</td>
                    <td className="p-4 text-right">
                      <div className="text-2xl font-bold text-green-600">{formatCurrency(item.TotalAmount)}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        item.Status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {item.Status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{formatDateTimeShort(item.CreatedAt)}</td>
                    <td className="p-4">
                      {item.Status === 'Active' ? (
                        <button
                          className="text-indigo-600 hover:text-indigo-900 font-semibold text-sm"
                          disabled={closingId === item.AppropriationId}
                          onClick={async () => {
                            if (!token) return;
                            if (!confirm(`Close appropriation for ${item.AppropriationCode}?`)) return;
                            setClosingId(item.AppropriationId);
                            try {
                              await closeBudgetAppropriation(token, item.AppropriationId);
                              setSuccess(`Successfully closed ${item.AppropriationCode}`);
                              void loadLedger();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Failed to close');
                            } finally {
                              setClosingId(null);
                            }
                          }}
                        >
                          {closingId === item.AppropriationId ? 'Closing...' : 'Close'}
                        </button>
                      ) : '—'}
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
          <svg className="w-24 h-24 text-slate-300 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h4 className="text-2xl font-bold text-slate-900 mb-3">No appropriations found</h4>
          <p className="text-slate-500 max-w-lg mx-auto">No records match your current filters. Try adjusting the criteria above.</p>
        </div>
      )}
    </section>
  );
};