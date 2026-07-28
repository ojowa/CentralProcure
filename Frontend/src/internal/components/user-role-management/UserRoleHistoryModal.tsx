'use client';

import React, { useEffect, useState } from 'react';
import { fetchUserRoleAudit, type UserRoleAuditResult } from '../../services/internalAuthService';
import type { InternalUserProfile } from '../../types/internal';

interface Props {
  user: InternalUserProfile | null;
  isOpen: boolean;
  token?: string | null;
  onClose: () => void;
}

export const UserRoleHistoryModal: React.FC<Props> = ({ user, isOpen, token, onClose }) => {
  const [history, setHistory] = useState<UserRoleAuditResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user && token) {
      const loadHistory = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await fetchUserRoleAudit(token, { InternalUserId: user.InternalUserId });
          setHistory(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load history');
        } finally {
          setIsLoading(false);
        }
      };
      void loadHistory();
    } else if (!isOpen) {
      setHistory([]);
      setError(null);
    }
  }, [isOpen, user, token]);

  if (!isOpen) return null;

  return (
    <div className="portal-modal-overlay">
      <div className="portal-modal-container" style={{ maxWidth: '800px', width: '95%' }}>
        <header className="portal-modal-header">
          <h3>Role Change History</h3>
          <button type="button" className="portal-modal-close" onClick={onClose}>&times;</button>
        </header>

        <div className="portal-modal-body">
          {user && (
            <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--portal-bg)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600 }}>{user.FirstName} {user.Surname}</div>
              <div className="plan-muted" style={{ fontSize: '0.85rem' }}>{user.Email}</div>
            </div>
          )}

          {isLoading ? (
            <div className="plan-empty">Loading history...</div>
          ) : error ? (
            <div className="portal-alert">{error}</div>
          ) : history.length === 0 ? (
            <div className="plan-empty">No role change history recorded for this user.</div>
          ) : (
            <div className="plan-table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="plan-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Previous Role</th>
                    <th>New Role</th>
                    <th>Changed By</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.AuditId}>
                      <td>{new Date(item.ChangedAt).toLocaleString()}</td>
                      <td>
                        <span style={{ color: 'var(--portal-slate)', textDecoration: 'line-through' }}>
                          {item.PreviousRoleName || 'Initial'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--portal-accent)' }}>
                        {item.NewRoleName}
                      </td>
                      <td>
                        <div>{item.ChangedByUsername || 'System'}</div>
                        <div style={{ fontSize: '0.7rem' }} className="plan-muted">{item.ChangedByEmail}</div>
                      </td>
                      <td style={{ fontStyle: 'italic', color: 'var(--portal-slate)' }}>
                        {item.ChangeReason || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="portal-modal-footer">
          <button type="button" className="plan-button plan-button--secondary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};
