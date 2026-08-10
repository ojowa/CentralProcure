'use client';

import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const confirmBtnClass = variant === 'danger'
    ? 'plan-button plan-button--danger'
    : variant === 'warning'
      ? 'plan-button plan-button--warning'
      : 'plan-button';

  return (
    <div className="portal-modal-overlay" onClick={onCancel}>
      <div className="portal-modal-container" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        <header className="portal-modal-header">
          <h3>{title}</h3>
          <button type="button" className="portal-modal-close" onClick={onCancel}>&times;</button>
        </header>
        <div className="portal-modal-body">
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{message}</p>
        </div>
        <footer className="portal-modal-footer">
          <button type="button" className="plan-button plan-button--secondary" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmBtnClass} onClick={() => void onConfirm()} disabled={isLoading}>
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
};
