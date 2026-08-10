'use client';

import React, { useState, useMemo } from 'react';
import type { InternalRoleRecord, InternalOrganizationalUnitRecord } from '../../types/internal';

interface OnboardingFormProps {
  roles: InternalRoleRecord[];
  units: InternalOrganizationalUnitRecord[];
  isLoading: boolean;
  onSubmit: (data: {
    Email: string;
    Username: string;
    FirstName: string;
    MiddleName: string;
    Surname: string;
    ServiceNumber: string;
    UnitId: string;
    Password: string;
    Role: string;
  }) => void | Promise<void>;
}

const SYSTEM_ADMIN_ROLES = ['admin'];

export const OnboardingForm: React.FC<OnboardingFormProps> = ({
  roles,
  units,
  isLoading,
  onSubmit
}) => {
  const [formData, setFormData] = useState({
    Email: '',
    Username: '',
    FirstName: '',
    MiddleName: '',
    Surname: '',
    ServiceNumber: '',
    UnitId: '',
    Password: '',
    Role: roles[0]?.CanonicalRoleKey ?? ''
  });

  const isSystemAdminRole = useMemo(() => 
    SYSTEM_ADMIN_ROLES.includes(formData.Role), 
    [formData.Role]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit(formData);
    // Reset form after successful submission
    setFormData({
      Email: '',
      Username: '',
      FirstName: '',
      MiddleName: '',
      Surname: '',
      ServiceNumber: '',
      UnitId: '',
      Password: '',
      Role: roles[0]?.CanonicalRoleKey ?? ''
    });
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <article className="portal-module-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h3>New Staff Onboarding</h3>
      <p className="plan-muted">Create a new internal identity and assign initial statutory permissions.</p>

      <form onSubmit={handleSubmit} style={{ marginTop: '24px', display: 'grid', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <label className="plan-field">
            <span>Surname *</span>
            <input
              className="plan-input"
              required
              value={formData.Surname}
              onChange={e => updateField('Surname', e.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>First Name *</span>
            <input
              className="plan-input"
              required
              value={formData.FirstName}
              onChange={e => updateField('FirstName', e.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>Middle Name <small className="plan-muted">(Optional)</small></span>
            <input
              className="plan-input"
              value={formData.MiddleName}
              onChange={e => updateField('MiddleName', e.target.value)}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <label className="plan-field">
            <span>Email Address *</span>
            <input
              type="email"
              className="plan-input"
              required
              value={formData.Email}
              onChange={e => updateField('Email', e.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>Username *</span>
            <input
              className="plan-input"
              required
              value={formData.Username}
              onChange={e => updateField('Username', e.target.value)}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <label className="plan-field">
            <span>Service Number *</span>
            <input
              className="plan-input"
              required
              value={formData.ServiceNumber}
              onChange={e => updateField('ServiceNumber', e.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>Initial Role *</span>
            <select
              className="plan-select"
              value={formData.Role}
              onChange={e => updateField('Role', e.target.value)}
            >
              {roles.map(r => <option key={r.RoleId} value={r.CanonicalRoleKey ?? r.RoleName}>{r.RoleName}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <label className="plan-field">
            <span>Organizational Unit {isSystemAdminRole ? <small className="plan-muted">(Optional for System Admin)</small> : '*'}</span>
            <select
              className="plan-select"
              required={!isSystemAdminRole}
              value={formData.UnitId}
              onChange={e => updateField('UnitId', e.target.value)}
            >
              <option value="">Select Unit</option>
              {units.map(u => (
                <option key={u.UnitId} value={u.UnitId}>{u.UnitName} ({u.UnitCode})</option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Initial Password *</span>
            <input
              type="password"
              className="plan-input"
              required
              value={formData.Password}
              onChange={e => updateField('Password', e.target.value)}
            />
          </label>
        </div>

        <div className="plan-actions" style={{ marginTop: '12px' }}>
          <button type="submit" className="plan-button" disabled={isLoading}>
            {isLoading ? 'Creating Identity...' : 'Complete Onboarding'}
          </button>
        </div>
      </form>
    </article>
  );
};
