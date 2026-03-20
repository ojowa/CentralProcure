'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataGrid, type Column, type SortColumn } from 'react-data-grid';
import type { BudgetRequisitionQueueItem } from '../../types/internal';
import { formatCurrency, formatDateTimeShort, getVarianceColor } from '../../utils/procureUtils';

type Props = {
  queue: BudgetRequisitionQueueItem[];
  selectedRequisitionId: string | null;
  onSelectRequisition: (requisitionId: string) => void;
  isLoading: boolean;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
};

type BudgetQueueRow = {
  id: string;
  title: string;
  department: string;
  budgetCode: string;
  status: string;
  stage: string;
  requested: number;
  available: number;
  committed: number;
  variance: number;
  requiredBy: string;
  updatedAt: string;
  raw: BudgetRequisitionQueueItem;
};

const getStatusTone = (value?: string | null): string => {
  switch ((value || '').toLowerCase()) {
    case 'approved':
    case 'confirmed':
    case 'budget confirmed':
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

const getPagingMeta = (page: number, pageSize: number, total: number) => {
  if (!total) return 'No records';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}-${end} of ${total}`;
};

const sortRows = (rows: BudgetQueueRow[], sortColumns: readonly SortColumn[]) => {
  const sort = sortColumns[0];
  if (!sort) {
    return rows;
  }

  const direction = sort.direction === 'DESC' ? -1 : 1;
  return [...rows].sort((left, right) => {
    const leftValue = left[sort.columnKey as keyof BudgetQueueRow];
    const rightValue = right[sort.columnKey as keyof BudgetQueueRow];

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true }) * direction;
  });
};

export const BudgetQueue = ({
  queue,
  selectedRequisitionId,
  onSelectRequisition,
  isLoading,
  page,
  total,
  onPageChange
}: Props) => {
  const pageSize = 12;
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window === 'undefined' ? 1440 : window.innerWidth);
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([
    { columnKey: 'updatedAt', direction: 'DESC' }
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const rows = useMemo<BudgetQueueRow[]>(
    () =>
      queue.map((item) => ({
        id: item.RequisitionId,
        title: item.Title,
        department: item.Department,
        budgetCode: item.BudgetCode || 'Not assigned',
        status: item.WorkflowStatus ?? item.Status,
        stage: item.CurrentStageTitle,
        requested: item.TotalEstimate,
        available: item.Available,
        committed: item.Committed,
        variance: item.Variance,
        requiredBy: item.RequiredBy ? formatDateTimeShort(item.RequiredBy) : 'Not set',
        updatedAt: formatDateTimeShort(item.UpdatedAt),
        raw: item
      })),
    [queue]
  );

  const sortedRows = useMemo(() => sortRows(rows, sortColumns), [rows, sortColumns]);

  const handleExport = () => {
  const headers = ['Requisition', 'Department', 'Budget Code', 'Status', 'Stage', 'Requested', 'Committed', 'Available', 'Variance', 'Required By', 'Updated'];
  const csvRows = sortedRows.map((row) => [
      row.title,
      row.department,
      row.budgetCode,
      row.status,
      row.stage,
      row.requested,
      row.committed,
      row.available,
      row.variance,
      row.requiredBy,
      row.updatedAt
    ]);
    const csv = [headers, ...csvRows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `budget-queue-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const allColumns = useMemo<readonly Column<BudgetQueueRow>[]>(
    () => [
      {
        key: 'title',
        name: 'Requisition',
        sortable: true,
        resizable: true,
        minWidth: 190,
        renderCell: ({ row }) => (
          <div className="budget-grid__title-cell">
            <strong>{row.title}</strong>
          </div>
        )
      },
      {
        key: 'department',
        name: 'Department',
        sortable: true,
        resizable: true,
        minWidth: 150
      },
      {
        key: 'budgetCode',
        name: 'Budget Code',
        sortable: true,
        resizable: true,
        minWidth: 120
      },
      {
        key: 'status',
        name: 'Status',
        sortable: true,
        resizable: true,
        minWidth: 120,
        renderCell: ({ row }) => (
          <span className={getStatusTone(row.status)}>{row.status}</span>
        )
      },
      {
        key: 'stage',
        name: 'Stage',
        sortable: true,
        resizable: true,
        minWidth: 150
      },
      {
        key: 'requested',
        name: 'Requested',
        sortable: true,
        resizable: true,
        minWidth: 115,
        renderCell: ({ row }) => formatCurrency(row.requested)
      },
      {
        key: 'committed',
        name: 'Committed',
        sortable: true,
        resizable: true,
        minWidth: 115,
        renderCell: ({ row }) => (
          <span className="text-amber-700 font-semibold">{formatCurrency(row.committed)}</span>
        )
      },
      {
        key: 'available',
        name: 'Available',
        sortable: true,
        resizable: true,
        minWidth: 115,
        renderCell: ({ row }) => (
          <span className="budget-grid__available">{formatCurrency(row.available)}</span>
        )
      },
      {
        key: 'variance',
        name: 'Variance',
        sortable: true,
        resizable: true,
        minWidth: 120,
        renderCell: ({ row }) => (
          <span className={getVarianceColor(row.variance)}>{formatCurrency(row.variance)}</span>
        )
      },
      {
        key: 'requiredBy',
        name: 'Required By',
        sortable: true,
        resizable: true,
        minWidth: 130
      },
      {
        key: 'updatedAt',
        name: 'Updated',
        sortable: true,
        resizable: true,
        minWidth: 135
      }
    ],
    []
  );

  const columns = useMemo<readonly Column<BudgetQueueRow>[]>(() => {
    const compactKeys =
      viewportWidth <= 640
        ? new Set(['title', 'department', 'status', 'requested', 'variance'])
        : viewportWidth <= 960
          ? new Set(['title', 'department', 'budgetCode', 'status', 'stage', 'requested', 'committed', 'variance'])
          : viewportWidth <= 1200
            ? new Set(['title', 'department', 'budgetCode', 'status', 'stage', 'requested', 'committed', 'available', 'updatedAt'])
            : null;

    if (!compactKeys) {
      return allColumns;
    }

    return allColumns.filter((column) => compactKeys.has(String(column.key)));
  }, [allColumns, viewportWidth]);

  return (
    <div className="budget-queue-surface space-y-3">
      <div className="budget-workspace__queue-header flex justify-end items-start">
        <div className="budget-grid__header-tools">
          <button type="button" className="plan-button plan-button--secondary" onClick={handleExport} disabled={!sortedRows.length}>
            Export CSV
          </button>
        </div>
      </div>

      {isLoading && <div className="plan-loading text-center py-12">Loading pipeline...</div>}

      {!isLoading && sortedRows.length > 0 ? (
        <div className="budget-grid-shell">
          <div className="budget-grid-shell__inner">
            <DataGrid
              className="budget-grid rdg-light"
              style={{ height: '100%', minHeight: 420 }}
              columns={columns}
              rows={sortedRows}
              rowKeyGetter={(row) => row.id}
              sortColumns={sortColumns}
              onSortColumnsChange={(nextSortColumns) => setSortColumns(nextSortColumns.slice(-1))}
              defaultColumnOptions={{
                sortable: true,
                resizable: true
              }}
              rowHeight={42}
              headerRowHeight={44}
              rowClass={(row) =>
                row.id === selectedRequisitionId ? 'budget-grid__row budget-grid__row--selected' : 'budget-grid__row'
              }
              onCellClick={({ row }) => onSelectRequisition(row.id)}
            />
          </div>
        </div>
      ) : null}

      {!isLoading && !sortedRows.length ? (
        <div className="budget-card p-16 text-center">
          <div className="text-4xl mb-4">📉</div>
          <h4 className="text-lg font-bold text-slate-900 mb-2">No items in queue</h4>
          <p className="text-slate-500 max-w-md mx-auto">No requisitions match current filters. Adjust filters or create new requisition.</p>
        </div>
      ) : null}

      {!isLoading ? (
        <div className="plan-pagination">
          <span className="plan-pagination__meta">{getPagingMeta(page, pageSize, total)}</span>
          <div className="plan-pagination__controls">
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={() => onPageChange(Math.max(page - 1, 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={() => onPageChange(page + 1)}
              disabled={page * pageSize >= total}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .budget-queue-surface {
          width: 100%;
          max-width: 960px;
          margin-inline: auto;
        }

        .budget-grid-shell {
          border: 1px solid var(--portal-border);
          border-radius: 20px;
          height: min(68vh, 720px);
          overflow: auto;
          background: rgba(255, 255, 255, 0.96);
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        .budget-grid-shell__inner {
          min-width: 0;
          width: 100%;
          min-height: 100%;
        }

        .budget-grid__header-tools {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
          padding-top: 6px;
        }

        .budget-grid :global(.rdg-header-row) {
          font-size: 0.76rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: #f8fafc;
        }

        .budget-grid {
          width: 100%;
          min-width: 0;
          max-width: 100%;
        }

        .budget-grid :global(.rdg-cell) {
          display: flex;
          align-items: center;
        }

        .budget-grid__title-cell {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .budget-grid__title-cell strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #0f172a;
        }

        .budget-grid__title-cell span {
          font-size: 0.8rem;
          color: #64748b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .budget-grid__available {
          color: #15803d;
          font-weight: 600;
        }

        .budget-grid :global(.budget-grid__row) {
          cursor: pointer;
        }

        .budget-grid :global(.budget-grid__row--selected) {
          background: rgba(191, 219, 254, 0.32);
        }

        @media (max-width: 720px) {
          .budget-queue-surface {
            max-width: 100%;
          }

          .budget-workspace__queue-header {
            gap: 12px;
            flex-direction: column;
            align-items: flex-start;
          }

          .budget-grid__header-tools {
            width: 100%;
            justify-content: space-between;
          }

          .budget-grid-shell {
            height: min(62vh, 560px);
          }
        }
      `}</style>
    </div>
  );
};
