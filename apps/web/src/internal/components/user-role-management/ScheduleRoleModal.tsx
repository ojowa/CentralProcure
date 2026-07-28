'use client';

import React, { useState, useEffect } from 'react';
import type { InternalUserProfile, InternalRoleRecord } from '../../types/internal';

interface ScheduleRoleModalProps {
  user: InternalUserProfile | null;
  roles: InternalRoleRecord[];
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (data: {
    Role: string;
    EffectiveFrom?: string | null;
    ExpiresAt?: string | null;
    BackupRole?: string | null;
  }) => void;
}

export const ScheduleRoleModal: React.FC<ScheduleRoleModalProps> = ({
  user,
  roles,
  isOpen,
  isLoading,
  onClose,
  onConfirm
}) => {
  const [role, setRole] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [backupRole, setBackupRole] = useState('');
  const [useScheduling, setUseScheduling] = useState(false);

  useEffect(() => {
    if (user) {
      setRole(user.RoleName);
      setEffectiveFrom(user.RoleEffectiveFrom ? new Date(user.RoleEffectiveFrom).toISOString().slice(0, 16) : '');
      setExpiresAt(user.RoleExpiresAt ? new Date(user.RoleExpiresAt).toISOString().slice(0, 16) : '');
      setBackupRole(user.BackupRoleName || '');
      setUseScheduling(!!(user.RoleEffectiveFrom || user.RoleExpiresAt));
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      Role: role,
      EffectiveFrom: useScheduling && effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
      ExpiresAt: useScheduling && expiresAt ? new Date(expiresAt).toISOString() : null,
      BackupRole: useScheduling && backupRole ? backupRole : null
    });
  };

  return (
    <div className="portal-modal-overlay">
      <div className="portal-modal-container" style={{ maxWidth: '500px' }}>
        <header className="portal-modal-header">
          <h3>Manage Role & Scheduling</h3>
          <button type="button" className="portal-modal-close" onClick={onClose}>&times;</button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="portal-modal-body">
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--portal-bg)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600 }}>{user.FirstName} {user.Surname}</div>
              <div className="plan-muted" style={{ fontSize: '0.85rem' }}>Current Role: {user.RoleName}</div>
            </div>

            <label className="plan-field">
              <span>Target Role</span>
              <select 
                className="plan-select" 
                value={role} 
                onChange={e => setRole(e.target.value)}
                required
              >
                {roles.map(r => (
                  <option key={r.RoleId} value={r.RoleName}>{r.RoleName}</option>
                ))}
              </select>
            </label>

            <div style={{ marginTop: '20px', padding: '16px', border: '1px solid var(--portal-border)', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px' }}>
                <input 
                  type="checkbox" 
                  checked={useScheduling} 
                  onChange={e => setUseScheduling(e.target.checked)} 
                />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Enable Scheduling / Temporary Assignment</span>
              </label>

              {useScheduling && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label className="plan-field">
                    <span>Effective From (Leave empty for immediate)</span>
                    <input 
                      type="datetime-local" 
                      className="plan-input" 
                      value={effectiveFrom}
                      onChange={e => setEffectiveFrom(e.target.value)}
                    />
                  </label>

                  <label className="plan-field">
                    <span>Expires At</span>
                    <input 
                      type="datetime-local" 
                      className="plan-input" 
                      value={expiresAt}
                      onChange={e => setExpiresAt(e.target.value)}
                    />
                  </label>

                  <label className="plan-field">
                    <span>Revert to Backup Role on Expiry</span>
                    <select 
                      className="plan-select" 
                      value={backupRole} 
                      onChange={e => setBackupRole(e.target.value)}
                    >
                      <option value="">No Backup (Keep expired role)</option>
                      {roles.map(r => (
                        <option key={r.RoleId} value={r.RoleName}>{r.RoleName}</option>
                      ))}
                    </select>
                    <p className="plan-muted" style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                      If set, the user will automatically revert to this role when the expiration date passes.
                    </p>
                  </label>
                </div>
              )}
            </div>
          </div>

          <footer className="portal-modal-footer">
            <button type="button" className="plan-button plan-button--secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="plan-button plan-button--primary" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Save Role Configuration'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
