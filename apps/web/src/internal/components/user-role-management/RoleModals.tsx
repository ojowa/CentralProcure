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
        <h2 style={{ margin: '0 0 20px 0' }}>Create New Role</h2>

        {error && (
          <div className="portal-alert animate-shake" style={{ marginBottom: '16px' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
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

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="submit"
                className="plan-button"
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Role'}
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
        <h2 style={{ margin: '0 0 20px 0' }}>Edit Role: {role.RoleName}</h2>

        {error && (
          <div className="portal-alert animate-shake" style={{ marginBottom: '16px' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
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

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="submit"
                className="plan-button"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
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

