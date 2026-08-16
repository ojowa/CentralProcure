'use client';

import React, { useState } from 'react';
import type { InternalRoleRecord, InternalOrganizationalUnitRecord } from '../../types/internal';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

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

type FieldErrors = Partial<Record<'Email' | 'Username' | 'FirstName' | 'Surname' | 'ServiceNumber' | 'UnitId' | 'Password' | 'ConfirmPassword', string>>;

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
    ConfirmPassword: '',
    Role: roles[0]?.CanonicalRoleKey ?? ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!formData.Surname.trim()) errors.Surname = 'Surname is required.';
    else if (formData.Surname.length > 128) errors.Surname = 'Must be 128 characters or fewer.';
    if (!formData.FirstName.trim()) errors.FirstName = 'First name is required.';
    else if (formData.FirstName.length > 128) errors.FirstName = 'Must be 128 characters or fewer.';
    if (!formData.Email.trim()) errors.Email = 'Email is required.';
    else if (!EMAIL_REGEX.test(formData.Email)) errors.Email = 'Invalid email address.';
    else if (formData.Email.length > 320) errors.Email = 'Must be 320 characters or fewer.';
    if (!formData.Username.trim()) errors.Username = 'Username is required.';
    else if (formData.Username.length < 3) errors.Username = 'Must be at least 3 characters.';
    else if (formData.Username.length > 64) errors.Username = 'Must be 64 characters or fewer.';
    if (!formData.ServiceNumber.trim()) errors.ServiceNumber = 'Service number is required.';
    else if (formData.ServiceNumber.length > 64) errors.ServiceNumber = 'Must be 64 characters or fewer.';
    if (!formData.UnitId) errors.UnitId = 'Organizational unit is required.';
    if (!formData.Password) errors.Password = 'Password is required.';
    else if (!PASSWORD_REGEX.test(formData.Password)) errors.Password = 'Must contain uppercase, lowercase, number, and special character.';
    if (!formData.ConfirmPassword) errors.ConfirmPassword = 'Password confirmation is required.';
    else if (formData.Password !== formData.ConfirmPassword) errors.ConfirmPassword = 'Passwords do not match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const initialData = {
      Email: '',
      Username: '',
      FirstName: '',
      MiddleName: '',
      Surname: '',
      ServiceNumber: '',
      UnitId: '',
      Password: '',
      ConfirmPassword: '',
      Role: roles[0]?.CanonicalRoleKey ?? ''
    };
    try {
      await onSubmit(formData);
      setFormData(initialData);
      setFieldErrors({});
    } catch {
      // Form preserved on error so user doesn't lose input
    }
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof FieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const fieldError = (field: keyof FieldErrors) =>
    fieldErrors[field] ? <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px' }}>{fieldErrors[field]}</p> : null;

  const inputClass = (field: keyof FieldErrors) =>
    `plan-input${fieldErrors[field] ? ' plan-input--error' : ''}`;

  return (
    <article className="portal-module-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h3>New Staff Onboarding</h3>
      <p className="plan-muted">Create a new internal identity and assign initial statutory permissions.</p>

      <form onSubmit={handleSubmit} style={{ marginTop: '24px', display: 'grid', gap: '20px' }}>
        <div className="urm-form-grid">
          <label className="plan-field">
            <span>Surname *</span>
            <input
              className={inputClass('Surname')}
              value={formData.Surname}
              onChange={e => updateField('Surname', e.target.value)}
              maxLength={128}
            />
            {fieldError('Surname')}
          </label>
          <label className="plan-field">
            <span>First Name *</span>
            <input
              className={inputClass('FirstName')}
              value={formData.FirstName}
              onChange={e => updateField('FirstName', e.target.value)}
              maxLength={128}
            />
            {fieldError('FirstName')}
          </label>
          <label className="plan-field">
            <span>Middle Name <small className="plan-muted">(Optional)</small></span>
            <input
              className="plan-input"
              value={formData.MiddleName}
              onChange={e => updateField('MiddleName', e.target.value)}
              maxLength={128}
            />
          </label>
        </div>

        <div className="urm-form-grid urm-form-grid--2">
          <label className="plan-field">
            <span>Email Address *</span>
            <input
              type="email"
              className={inputClass('Email')}
              value={formData.Email}
              onChange={e => updateField('Email', e.target.value)}
              maxLength={320}
            />
            {fieldError('Email')}
          </label>
          <label className="plan-field">
            <span>Username *</span>
            <input
              className={inputClass('Username')}
              value={formData.Username}
              onChange={e => updateField('Username', e.target.value)}
              minLength={3}
              maxLength={64}
            />
            {fieldError('Username')}
          </label>
        </div>

        <div className="urm-form-grid urm-form-grid--2">
          <label className="plan-field">
            <span>Service Number *</span>
            <input
              className={inputClass('ServiceNumber')}
              value={formData.ServiceNumber}
              onChange={e => updateField('ServiceNumber', e.target.value)}
              maxLength={64}
            />
            {fieldError('ServiceNumber')}
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

        <div className="urm-form-grid urm-form-grid--2">
          <label className="plan-field">
            <span>Organizational Unit *</span>
            <select
              className={inputClass('UnitId')}
              value={formData.UnitId}
              onChange={e => updateField('UnitId', e.target.value)}
            >
              <option value="">Select Unit</option>
              {units.map(u => (
                <option key={u.UnitId} value={u.UnitId}>{u.UnitName} ({u.UnitCode})</option>
              ))}
            </select>
            {fieldError('UnitId')}
          </label>
          <label className="plan-field">
            <span>Initial Password *</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className={inputClass('Password')}
                value={formData.Password}
                onChange={e => updateField('Password', e.target.value)}
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
            {fieldError('Password')}
            <small className="plan-muted" style={{ fontSize: '0.7rem' }}>
              Min 8 chars: uppercase, lowercase, number, special character
            </small>
          </label>
        </div>

        <div className="urm-form-grid urm-form-grid--2">
          <label className="plan-field">
            <span>Confirm Password *</span>
            <input
              type={showPassword ? 'text' : 'password'}
              className={inputClass('ConfirmPassword')}
              value={formData.ConfirmPassword}
              onChange={e => updateField('ConfirmPassword', e.target.value)}
            />
            {fieldError('ConfirmPassword')}
          </label>
          <div />
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
