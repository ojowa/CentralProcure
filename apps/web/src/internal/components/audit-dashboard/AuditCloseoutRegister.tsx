'use client';

import React from 'react';
import type { AuditCloseoutItem } from '../../types/internal';

const formatDateTimeShort = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const toTitle = (value?: string | null) => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'accounting_officer_review') {
    return 'CGIS Approval';
  }

  return value
    ? value.replace(/_/g, ' ').split(' ').map(p => p ? p[0].toUpperCase() + p.slice(1) : p).join(' ')
    : 'Unspecified';
};

type Props = {
  closeouts: AuditCloseoutItem[];
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
};

export const AuditCloseoutRegister = ({ 
  closeouts, statusFilter, onStatusFilterChange, isLoading, onRefresh 
}: Props) => {
  return (
    <article className="portal-module-card animate-fade">
      <div className="view-header">
        <h3>Closeout Register</h3>
        <p>Immutable archive of completed procurement transactions.</p>
      </div>

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Filter Status</span>
            <select
              className="plan-select"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            >
              <option value="">All Closeouts</option>
              <option value="Pending">Pending</option>
              <option value="InProgress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </label>
          <div className="plan-actions">
            <button 
              type="button" 
              className="plan-button plan-button--secondary" 
              onClick={onRefresh} 
              disabled={isLoading}
            >
              {isLoading ? 'Syncing...' : 'Sync Register'}
            </button>
          </div>
        </div>
      </div>

      <div className="plan-table-wrapper">
        <table className="plan-table">
          <thead>
            <tr>
              <th>Closeout Code</th>
              <th>Contract</th>
              <th>Description</th>
              <th>Status</th>
              <th>Acceptance</th>
              <th>Payment</th>
              <th>Archive</th>
              <th>Archived By</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {closeouts.map((closeout) => (
              <tr key={closeout.CloseoutId}>
                <td>
                  <code className="plan-code">{closeout.CloseoutCode}</code>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{closeout.ContractCode}</div>
                  <div className="plan-muted" style={{ fontSize: '0.75rem' }}>{closeout.ContractTitle || '—'}</div>
                </td>
                <td>
                  <div>{closeout.Description || '—'}</div>
                </td>
                <td>
                  <span className={`admin-status ${closeout.Status === 'Completed' ? 'admin-status--good' : 'admin-status--warn'}`}>
                    {closeout.Status}
                  </span>
                </td>
                <td>{closeout.FinalAcceptanceCompleted ? '✓' : '—'}</td>
                <td>{closeout.FinalPaymentCompleted ? '✓' : '—'}</td>
                <td>{closeout.ArchiveLocation || '—'}</td>
                <td>{closeout.ArchivedBy || '—'}</td>
                <td>{formatDateTimeShort(closeout.ArchivedAt || closeout.CompletedAt || closeout.CreatedAt)}</td>
              </tr>
            ))}
            {!closeouts.length && (
              <tr>
                <td colSpan={9} className="plan-empty">No closeout records matched the criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
};
