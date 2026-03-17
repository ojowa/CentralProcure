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

const toTitle = (value?: string | null) =>
  value ? value.replace(/_/g, ' ').split(' ').map(p => p ? p[0].toUpperCase() + p.slice(1) : p).join(' ') : 'Unspecified';

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
              <option value="Submitted">Submitted</option>
              <option value="Archived">Archived</option>
              <option value="Reopened">Reopened</option>
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
              <th>Reference</th>
              <th>Record Description</th>
              <th>Status</th>
              <th>Archive Trail</th>
              <th>Archived At</th>
            </tr>
          </thead>
          <tbody>
            {closeouts.map((closeout) => (
              <tr key={closeout.CloseoutId}>
                <td>
                  <code className="plan-code">{closeout.CloseoutReference}</code>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{closeout.RecordTitle || `${toTitle(closeout.EntityType)} · ${closeout.EntityId}`}</div>
                  <div className="plan-muted" style={{ fontSize: '0.75rem' }}>{closeout.Summary}</div>
                </td>
                <td>
                  <span className={`admin-status ${closeout.Status === 'Archived' ? 'admin-status--good' : 'admin-status--warn'}`}>
                    {closeout.Status}
                  </span>
                </td>
                <td>
                  <div style={{ fontSize: '0.8125rem' }}>{closeout.ArchiveLocation || 'Cloud Storage'}</div>
                  <div className="plan-muted" style={{ fontSize: '0.7rem' }}>By: {closeout.ArchivedBy || 'System'}</div>
                </td>
                <td>{formatDateTimeShort(closeout.ArchivedAt || closeout.CreatedAt)}</td>
              </tr>
            ))}
            {!closeouts.length && (
              <tr>
                <td colSpan={5} className="plan-empty">No closeout records matched the criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
};
