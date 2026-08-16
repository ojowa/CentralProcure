'use client';

import React, { useState } from 'react';
import type { InternalRoleRecord } from '../../types/internal';

interface CreateRoleModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (data: { RoleName: string; Description?: string }) => void | Promise<void>;
}

interface EditRoleModalProps {
  role: InternalRoleRecord | null;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (roleId: string, data: { RoleName: string; Description?: string }) => void | Promise<void>;
}

export const CreateRoleModal: React.FC<CreateRoleModalProps> = ({
  isOpen,
  isLoading,
  onClose,
  onConfirm
}) => {
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!roleName.trim()) {
      setError('Role name is required');
      return;
    }

    if (roleName.length < 3) {
      setError('Role name must be at least 3 characters');
      return;
    }

    void onConfirm({ RoleName: roleName.trim(), Description: description.trim() || undefined });
    setRoleName('');
    setDescription('');
  };

  const handleClose = () => {
    setRoleName('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <div className="portal-modal-overlay" onClick={handleClose}>
      <div className="portal-modal-container" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <header className="portal-modal-header">
          <h3>Create New Role</h3>
          <button type="button" className="portal-modal-close" onClick={handleClose} aria-label="Close">&times;</button>
        </header>

        <div className="portal-modal-body">
          {error && (
            <div className="portal-alert animate-shake" style={{ marginBottom: '16px' }}>{error}</div>
          )}

          <form id="create-role-form" onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <label className="plan-field">
                <span>Role Name *</span>
                <input
                  className="plan-input"
                  required
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  placeholder="e.g., Comptroller Procurement"
                />
              </label>

              <label className="plan-field">
                <span>Description</span>
                <textarea
                  className="plan-input"
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the role's responsibilities..."
                />
              </label>
            </div>
          </form>
        </div>

        <footer className="portal-modal-footer">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button type="submit" form="create-role-form" className="plan-button" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Role'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export const EditRoleModal: React.FC<EditRoleModalProps> = ({
  role,
  isOpen,
  isLoading,
  onClose,
  onConfirm
}) => {
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (role) {
      setRoleName(role.RoleName);
      setDescription(role.Description || '');
    }
  }, [role]);

  if (!isOpen || !role) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!roleName.trim()) {
      setError('Role name is required');
      return;
    }

    void onConfirm(role.RoleId, {
      RoleName: roleName.trim(),
      Description: description.trim() || undefined
    });
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <div className="portal-modal-overlay" onClick={handleClose}>
      <div className="portal-modal-container" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <header className="portal-modal-header">
          <h3>Edit Role: {role.RoleName}</h3>
          <button type="button" className="portal-modal-close" onClick={handleClose} aria-label="Close">&times;</button>
        </header>

        <div className="portal-modal-body">
          {error && (
            <div className="portal-alert animate-shake" style={{ marginBottom: '16px' }}>{error}</div>
          )}

          <form id="edit-role-form" onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <label className="plan-field">
                <span>Role Name *</span>
                <input
                  className="plan-input"
                  required
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                />
              </label>

              <label className="plan-field">
                <span>Description</span>
                <textarea
                  className="plan-input"
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the role's responsibilities..."
                />
              </label>
            </div>
          </form>
        </div>

        <footer className="portal-modal-footer">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button type="submit" form="edit-role-form" className="plan-button" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </footer>
      </div>
    </div>
  );
};

