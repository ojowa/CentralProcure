'use client';

import React, { useState } from 'react';
import type { InternalUserProfile } from '../../types/internal';

interface ResetPasswordModalProps {
  user: InternalUserProfile | null;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (userId: string, newPassword: string, requireChange: boolean) => void | Promise<void>;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  isOpen,
  isLoading,
  onClose,
  onConfirm
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requireChange, setRequireChange] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen || !user) return null;

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one digit';
    if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must contain at least one special character';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    void onConfirm(user.InternalUserId, newPassword, requireChange);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '500px'
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 8px 0' }}>Reset Password</h2>
        <p className="plan-muted" style={{ margin: '0 0 20px 0' }}>
          Resetting password for <strong>{user.FirstName} {user.Surname}</strong> ({user.Email})
        </p>

        {error && (
          <div className="portal-alert animate-shake" style={{ marginBottom: '16px' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <label className="plan-field">
              <span>New Password *</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="plan-input"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="plan-button plan-button--secondary"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <small className="plan-muted">
                Must be at least 8 characters with uppercase, lowercase, number, and special character.
              </small>
            </label>

            <label className="plan-field">
              <span>Confirm Password *</span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="plan-input"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </label>

            <label className="plan-field" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={requireChange}
                onChange={e => setRequireChange(e.target.checked)}
              />
              <span>Require password change on next login</span>
            </label>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="submit"
                className="plan-button"
                disabled={isLoading}
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
              <button
                type="button"
                className="plan-button plan-button--secondary"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
