'use client';

import React, { useState, useEffect } from 'react';
import type { InternalUserProfile, InternalRoleRecord, InternalOrganizationalUnitRecord } from '../../types/internal';

interface EditUserModalProps {
  user: InternalUserProfile | null;
  roles: InternalRoleRecord[];
  units: InternalOrganizationalUnitRecord[];
  isOpen: boolean;
  isLoading: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSave: (userId: string, data: {
    Email: string;
    Username: string;
    FirstName: string;
    MiddleName?: string;
    Surname: string;
    ServiceNumber: string;
    UnitId?: string;
    IsActive: boolean;
  }) => void | Promise<void>;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  roles,
  units,
  isOpen,
  isLoading,
  errorMessage,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    Email: '',
    Username: '',
    FirstName: '',
    MiddleName: '',
    Surname: '',
    ServiceNumber: '',
    UnitId: '',
    IsActive: true
  });

  useEffect(() => {
    if (user) {
      setFormData({
        Email: user.Email,
        Username: user.Username,
        FirstName: user.FirstName,
        MiddleName: user.MiddleName || '',
        Surname: user.Surname,
        ServiceNumber: user.ServiceNumber,
        UnitId: user.UnitId || '',
        IsActive: user.Status === 'Active'
      });
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSave(user.InternalUserId, {
      ...formData,
      MiddleName: formData.MiddleName || undefined
    });
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
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 20px 0' }}>Edit User: {user.FirstName} {user.Surname}</h2>

        {errorMessage ? (
          <div className="portal-alert" style={{ marginBottom: '16px' }}>
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <label className="plan-field">
                <span>Surname *</span>
                <input
                  className="plan-input"
                  required
                  value={formData.Surname}
                  onChange={e => setFormData(p => ({ ...p, Surname: e.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>First Name *</span>
                <input
                  className="plan-input"
                  required
                  value={formData.FirstName}
                  onChange={e => setFormData(p => ({ ...p, FirstName: e.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Middle Name <small className="plan-muted">(Optional)</small></span>
                <input
                  className="plan-input"
                  value={formData.MiddleName}
                  onChange={e => setFormData(p => ({ ...p, MiddleName: e.target.value }))}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label className="plan-field">
                <span>Email Address *</span>
                <input
                  className="plan-input"
                  type="email"
                  required
                  value={formData.Email}
                  onChange={e => setFormData(p => ({ ...p, Email: e.target.value }))}
                />
              </label>
              <label className="plan-field">
                <span>Username *</span>
                <input
                  className="plan-input"
                  required
                  value={formData.Username}
                  onChange={e => setFormData(p => ({ ...p, Username: e.target.value }))}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label className="plan-field">
                <span>Service Number *</span>
                <input
                  className="plan-input"
                  required
                  value={formData.ServiceNumber}
                  onChange={e => setFormData(p => ({ ...p, ServiceNumber: e.target.value }))}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label className="plan-field">
                <span>Organizational Unit</span>
                <select
                  className="plan-select"
                  value={formData.UnitId}
                  onChange={e => setFormData(p => ({ ...p, UnitId: e.target.value }))}
                >
                  <option value="">No Unit</option>
                  {units.map(u => (
                    <option key={u.UnitId} value={u.UnitId}>{u.UnitName} ({u.UnitCode})</option>
                  ))}
                </select>
              </label>
              <label className="plan-field">
                <span>Status</span>
                <select
                  className="plan-select"
                  value={formData.IsActive ? 'Active' : 'Inactive'}
                  onChange={e => setFormData(p => ({ ...p, IsActive: e.target.value === 'Active' }))}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>

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
                onClick={onClose}
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
