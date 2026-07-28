'use client';

import React, { useEffect, useState } from 'react';
import type { InternalModule, InternalUserProfile, InternalUserProfileUpdateRequest } from '../types/internal';
import { fetchInternalUserProfile, updateInternalUserProfile } from '../services/internalAuthService';
import { formatDate } from '../utils/procureUtils';

interface ProfilePageProps {
  module: InternalModule;
  token: string | null;
  userEmail?: string | null;
}

export const ProfilePage = ({ module, token }: ProfilePageProps) => {
  const [profile, setProfile] = useState<InternalUserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [formData, setFormData] = useState<InternalUserProfileUpdateRequest>({
    Username: '',
    FirstName: '',
    MiddleName: '',
    Surname: ''
  });

  useEffect(() => {
    if (!token) {
      setError('Authentication session is missing.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetchInternalUserProfile(token)
      .then((data) => {
        if (isMounted) {
          setProfile(data);
          setFormData({
            Username: data.Username,
            FirstName: data.FirstName,
            MiddleName: data.MiddleName ?? '',
            Surname: data.Surname
          });
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load profile.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleChange = (field: keyof InternalUserProfileUpdateRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setFeedback(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const updated = await updateInternalUserProfile(token, formData);
      setProfile(updated);
      setIsEditing(false);
      setFeedback('Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="portal-module">
        <div className="plan-loading">Authenticating and retrieving profile context...</div>
      </section>
    );
  }

  const getInitials = () => {
    if (!profile) return '??';
    return `${profile.FirstName[0]}${profile.Surname[0]}`.toUpperCase();
  };

  return (
    <section className="portal-module portal-module--tracking">
      {/* Profile Hero Section */}
      <div className="admin-hero" style={{ marginBottom: '24px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div className="portal-emblem" style={{ width: '80px', height: '80px', fontSize: '28px', borderRadius: '24px' }}>
            {getInitials()}
          </div>
          <div>
            <div className="admin-kicker">Service Identity</div>
            <h2 style={{ margin: '4px 0' }}>{profile ? `${profile.FirstName} ${profile.Surname}` : 'Internal User'}</h2>
            <div className="admin-tags">
              <span className="admin-tag">{profile?.RoleName || 'Authorized Personnel'}</span>
              <span className="admin-tag" style={{ opacity: 0.8 }}>#{profile?.ServiceNumber}</span>
            </div>
          </div>
        </div>
        <div className="admin-metrics" style={{ textAlign: 'right' }}>
          <div className="admin-metric">
            <span>Account Status</span>
            <strong style={{ color: profile?.Status === 'Active' ? 'var(--portal-forest)' : 'inherit' }}>
              {profile?.Status || 'Unknown'}
            </strong>
          </div>
        </div>
      </div>

      {error && <div className="portal-alert" style={{ marginBottom: '20px' }}>{error}</div>}
      {feedback && <div className="requisition-success" style={{ marginBottom: '20px' }}>{feedback}</div>}

      {!profile && !error && <div className="plan-empty">No profile context available.</div>}

      {profile && (
        <div className="requisition-tracking-grid">
          {/* Left Column: Personal Info & Edit */}
          <div className="requisition-panel">
            <article className="requisition-card">
              <div className="requisition-card__header">
                <div>
                  <h3>Personal Information</h3>
                  <p>Details used for workflow signature and official record-keeping.</p>
                </div>
                {!isEditing && (
                  <button type="button" className="plan-link" onClick={() => setIsEditing(true)}>
                    Modify Details
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleSave} className="plan-form" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <label className="plan-field">
                      <span>Username</span>
                      <input className="plan-input" value={formData.Username} onChange={(e) => handleChange('Username', e.target.value)} required />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <label className="plan-field">
                        <span>First Name</span>
                        <input className="plan-input" value={formData.FirstName} onChange={(e) => handleChange('FirstName', e.target.value)} required />
                      </label>
                      <label className="plan-field">
                        <span>Surname</span>
                        <input className="plan-input" value={formData.Surname} onChange={(e) => handleChange('Surname', e.target.value)} required />
                      </label>
                    </div>
                    <label className="plan-field">
                      <span>Middle Name (Optional)</span>
                      <input className="plan-input" value={formData.MiddleName} onChange={(e) => handleChange('MiddleName', e.target.value)} />
                    </label>
                    
                    <div className="requisition-actions" style={{ marginTop: '8px' }}>
                      <button type="submit" className="plan-button" disabled={isSaving}>
                        {isSaving ? 'Synchronizing...' : 'Save Profile'}
                      </button>
                      <button 
                        type="button" 
                        className="plan-button plan-button--secondary" 
                        onClick={() => setIsEditing(false)}
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--portal-slate)', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>Legal Name</span>
                    <strong style={{ fontSize: '15px', color: 'var(--portal-ink)' }}>{`${profile.FirstName} ${profile.MiddleName ? profile.MiddleName + ' ' : ''}${profile.Surname}`}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--portal-slate)', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>Display Identity</span>
                    <strong style={{ fontSize: '14px', color: 'var(--portal-ink)' }}>{profile.Username}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--portal-slate)', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>Contact Channel</span>
                    <strong style={{ fontSize: '14px', color: 'var(--portal-ink)', wordBreak: 'break-all' }}>{profile.Email}</strong>
                  </div>
                </div>
              )}
            </article>

            <article className="requisition-card" style={{ marginTop: '20px' }}>
              <div className="requisition-card__header">
                <div>
                  <h3>Platform Security</h3>
                  <p>Manage your access credentials and authentication methods.</p>
                </div>
              </div>
              <p className="plan-muted" style={{ marginBottom: '16px' }}>
                Your session is secured with hardware-aware tokens. Password resets require departmental verification.
              </p>
              <button type="button" className="plan-button plan-button--secondary" style={{ width: '100%' }} disabled>
                Update Authentication Password
              </button>
            </article>
          </div>

          {/* Right Column: Service & Professional Context */}
          <div className="requisition-panel">
            <article className="requisition-card">
              <div className="requisition-card__header">
                <div>
                  <h3>Organizational Authority</h3>
                  <p>Deployment details and granted procurement powers.</p>
                </div>
              </div>

              <div className="routing-panel" style={{ marginTop: '12px', background: 'rgba(11, 93, 59, 0.03)' }}>
                <div className="routing-panel__grid">
                  <div>
                    <span>Primary Unit</span>
                    <strong>{profile.UnitName}</strong>
                  </div>
                  <div>
                    <span>Assigned Role</span>
                    <strong>{profile.RoleName}</strong>
                  </div>
                  <div>
                    <span>Service Number</span>
                    <strong>{profile.ServiceNumber}</strong>
                  </div>
                  <div>
                    <span>Authority Level</span>
                    <strong>{profile.Status}</strong>
                  </div>
                </div>
              </div>

              <div className="requisition-detail-note" style={{ marginTop: '20px' }}>
                <h4>PPA 2007 Accountability Statement</h4>
                <p style={{ fontSize: '12px', color: 'var(--portal-slate)' }}>
                  All actions performed under this identity (<strong>{profile.Username}</strong>) are bound by the statutory requirements of the Nigeria Public Procurement Act. 
                  Digital signatures generated by this account are legally binding for requisition, evaluation, and approval workflows.
                </p>
              </div>
            </article>

            <article className="requisition-card" style={{ marginTop: '20px' }}>
              <div className="requisition-card__header">
                <div>
                  <h3>Activity History</h3>
                  <p>Summary of your recent portal engagement.</p>
                </div>
              </div>
              <div className="admin-list">
                <li style={{ background: 'transparent', padding: '8px 0', border: 'none', borderBottom: '1px solid var(--portal-border)', borderRadius: 0 }}>
                  <span>Onboarded</span>
                  <strong>{formatDate(profile.CreatedAt)}</strong>
                </li>
                <li style={{ background: 'transparent', padding: '8px 0', border: 'none', borderRadius: 0 }}>
                  <span>Last Access</span>
                  <strong>{profile.LastLogin ? formatDate(profile.LastLogin) : 'Initial Session'}</strong>
                </li>
              </div>
            </article>
          </div>
        </div>
      )}
    </section>
  );
};
