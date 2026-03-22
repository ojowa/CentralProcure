'use client';

import React from 'react';
import type { ModuleAccessAuditEntry } from '../../services/auditAccessService';
import { formatAuditState, getAuditTargetLabel } from '../../services/auditAccessService';

interface AccessAuditPanelProps {
  entries: ModuleAccessAuditEntry[];
  isLoading: boolean;
  onRefresh: () => void | Promise<void>;
  onExportCsv: () => void;
  showTarget?: boolean;
}

export const AccessAuditPanel: React.FC<AccessAuditPanelProps> = ({
  entries,
  isLoading,
  onRefresh,
  onExportCsv,
  showTarget = true
}) => {
  return (
    <div style={{ marginTop: '24px' }}>
      <div className="planning-committee__panel-header">
        <div>
          <h3 style={{ margin: 0 }}>Access Change Audit</h3>
          <p className="plan-muted">Recent access changes for the selected target.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => onRefresh()}
            disabled={isLoading}
          >
            Refresh Audit
          </button>
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={onExportCsv}
            disabled={entries.length === 0}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="plan-table-wrapper">
        <table className="plan-table">
          <thead>
            <tr>
              <th>When</th>
              {showTarget && <th>Target</th>}
              <th>Module</th>
              <th>From → To</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={showTarget ? 5 : 4} className="plan-empty">
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.AuditId}>
                  <td>{new Date(entry.ChangedAt).toLocaleString()}</td>
                  {showTarget && <td>{getAuditTargetLabel(entry)}</td>}
                  <td>{entry.ModuleId}</td>
                  <td>
                    {formatAuditState(entry.PreviousState)} → {formatAuditState(entry.NewState)}
                  </td>
                  <td>{entry.ChangeSource}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface CompactAuditLogProps {
  entries: ModuleAccessAuditEntry[];
  maxEntries?: number;
}

export const CompactAuditLog: React.FC<CompactAuditLogProps> = ({
  entries,
  maxEntries = 5
}) => {
  const displayEntries = entries.slice(0, maxEntries);

  if (displayEntries.length === 0) {
    return <p className="plan-muted">No recent changes.</p>;
  }

  return (
    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.875rem' }}>
      {displayEntries.map((entry) => (
        <li key={entry.AuditId} style={{ marginBottom: '4px' }}>
          <span className="plan-muted">{new Date(entry.ChangedAt).toLocaleDateString()}</span>
          {' - '}
          <strong>{entry.ModuleId}</strong>
          {' changed from '}
          {formatAuditState(entry.PreviousState)}
          {' to '}
          {formatAuditState(entry.NewState)}
        </li>
      ))}
    </ul>
  );
};
