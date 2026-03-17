'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type { InternalModule, InternalUserProfile, InternalRoleRecord, InternalOrganizationalUnitRecord } from '../types/internal';
import { 
  fetchInternalUsers, 
  fetchInternalRoles, 
  fetchInternalUnits,
  registerInternalUser,
  updateInternalUserRole 
} from '../services/internalAuthService';

type Props = {
  module: InternalModule;
  token?: string | null;
};

export const UserRoleManagementModule = ({ module, token }: Props) => {
  const [users, setUsers] = useState<InternalUserProfile[]>([]);
  const [roles, setRoles] = useState<InternalRoleRecord[]>([]);
  const [units, setUnits] = useState<InternalOrganizationalUnitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'onboarding'>('users');
  const [searchQuery, setSearchQuery] = useState('');

  // Onboarding Form State
  const [onboardingForm, setOnboardingForm] = useState({
    Email: '',
    Username: '',
    FirstName: '',
    MiddleName: '',
    Surname: '',
    ServiceNumber: '',
    UnitId: '',
    Password: '',
    Role: 'Internal'
  });

  const loadData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [u, r, un] = await Promise.all([
        fetchInternalUsers(token),
        fetchInternalRoles(),
        fetchInternalUnits()
      ]);
      setUsers(u);
      setRoles(r);
      setUnits(un);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load management data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u => 
      u.Email.toLowerCase().includes(q) || 
      u.Username.toLowerCase().includes(q) ||
      u.FirstName.toLowerCase().includes(q) ||
      u.Surname.toLowerCase().includes(q) ||
      u.ServiceNumber.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await registerInternalUser({
        ...onboardingForm,
        UnitId: onboardingForm.UnitId as any
      } as any);
      setSuccess(`User ${onboardingForm.Email} onboarded successfully.`);
      setOnboardingForm({
        Email: '',
        Username: '',
        FirstName: '',
        MiddleName: '',
        Surname: '',
        ServiceNumber: '',
        UnitId: '',
        Password: '',
        Role: 'Internal'
      });
      await loadData();
      setActiveTab('users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to onboard user.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateInternalUserRole(token, {
        InternalUserId: userId,
        Role: newRole
      });
      setSuccess('User role updated successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="admin-hub animate-fade-up">
      <header className="admin-hero">
        <div>
          <div className="admin-kicker">{module.controlPurpose}</div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
          <div className="admin-tags">
            <span className="admin-tag">{users.length} Active Users</span>
            <span className="admin-tag">{roles.length} Defined Roles</span>
            <span className="admin-tag">{units.length} Organizational Units</span>
          </div>
        </div>
        <div className="admin-metrics">
           <div className="admin-metric">
              <strong>{users.filter(u => u.Status === 'Active').length}</strong>
              <span>Active</span>
           </div>
           <div className="admin-metric">
              <strong>{users.filter(u => u.Status === 'Pending').length}</strong>
              <span>Pending</span>
           </div>
        </div>
      </header>

      {error && <div className="portal-alert animate-shake">{error}</div>}
      {success && <div className="plan-success">{success}</div>}

      <div className="workflow-config-tabs">
        <button type="button" className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>Active Directory</button>
        <button type="button" className={activeTab === 'roles' ? 'active' : ''} onClick={() => setActiveTab('roles')}>Role Catalog</button>
        <button type="button" className={activeTab === 'onboarding' ? 'active' : ''} onClick={() => setActiveTab('onboarding')}>User Onboarding</button>
        <div style={{ flex: 1 }} />
        <button type="button" className="workflow-config-refresh" onClick={loadData} disabled={isLoading}>
          {isLoading ? 'Syncing...' : 'Refresh Directory'}
        </button>
      </div>

      <div className="management-viewport" style={{ marginTop: '24px' }}>
        {activeTab === 'users' && (
          <article className="portal-module-card">
            <div className="plan-toolbar" style={{ marginBottom: '20px' }}>
              <div className="plan-filters">
                <label className="plan-field" style={{ width: '400px' }}>
                  <span>Search Directory</span>
                  <input 
                    className="plan-input" 
                    placeholder="Search by name, email, or service number..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="plan-table-wrapper">
              <table className="plan-table">
                <thead>
                  <tr>
                    <th>Identity</th>
                    <th>Service Info</th>
                    <th>Role & Unit</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.InternalUserId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{user.FirstName} {user.Surname}</div>
                        <div className="plan-muted">{user.Email}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--portal-slate)' }}>@{user.Username}</div>
                      </td>
                      <td>
                        <div>{user.ServiceNumber}</div>
                        <div className="plan-muted" style={{ fontSize: '0.75rem' }}>
                          Last Login: {user.LastLogin ? new Date(user.LastLogin).toLocaleDateString() : 'Never'}
                        </div>
                      </td>
                      <td>
                        <div className="plan-code">{user.RoleName}</div>
                        <div className="plan-muted" style={{ fontSize: '0.75rem' }}>{user.UnitName || 'No Unit'}</div>
                      </td>
                      <td>
                        <span className={`admin-status ${user.Status === 'Active' ? 'admin-status--good' : 'admin-status--warn'}`}>
                          {user.Status}
                        </span>
                      </td>
                      <td>
                        <select 
                          className="plan-select" 
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          value={user.RoleName}
                          onChange={e => handleRoleChange(user.InternalUserId, e.target.value)}
                          disabled={isLoading}
                        >
                          {roles.map(r => <option key={r.RoleId} value={r.RoleName}>{r.RoleName}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )}

        {activeTab === 'roles' && (
          <div className="roles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {roles.map(role => (
              <article key={role.RoleId} className="portal-module-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0 }}>{role.RoleName}</h3>
                  <span className={`admin-status ${role.IsActive ? 'admin-status--good' : ''}`}>
                    {role.IsActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="plan-muted" style={{ marginTop: '12px', fontSize: '0.875rem' }}>
                  {role.Description || 'No description provided for this statutory role.'}
                </p>
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--portal-border)' }}>
                   <div style={{ fontSize: '0.75rem', color: 'var(--portal-slate)' }}>
                     Users Assigned: <strong>{users.filter(u => u.RoleName === role.RoleName).length}</strong>
                   </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {activeTab === 'onboarding' && (
          <article className="portal-module-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h3>New Staff Onboarding</h3>
            <p className="plan-muted">Create a new internal identity and assign initial statutory permissions.</p>
            
            <form onSubmit={handleOnboard} style={{ marginTop: '24px', display: 'grid', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                <label className="plan-field">
                  <span>Surname</span>
                  <input className="plan-input" required value={onboardingForm.Surname} onChange={e => setOnboardingForm(p => ({ ...p, Surname: e.target.value }))} />
                </label>
                <label className="plan-field">
                  <span>First Name</span>
                  <input className="plan-input" required value={onboardingForm.FirstName} onChange={e => setOnboardingForm(p => ({ ...p, FirstName: e.target.value }))} />
                </label>
                <label className="plan-field">
                  <span>Middle Name <small className="plan-muted">(Optional)</small></span>
                  <input className="plan-input" value={onboardingForm.MiddleName} onChange={e => setOnboardingForm(p => ({ ...p, MiddleName: e.target.value }))} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <label className="plan-field">
                  <span>Email Address</span>
                  <input type="email" className="plan-input" required value={onboardingForm.Email} onChange={e => setOnboardingForm(p => ({ ...p, Email: e.target.value }))} />
                </label>
                <label className="plan-field">
                  <span>Username</span>
                  <input className="plan-input" required value={onboardingForm.Username} onChange={e => setOnboardingForm(p => ({ ...p, Username: e.target.value }))} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <label className="plan-field">
                  <span>Service Number</span>
                  <input className="plan-input" required value={onboardingForm.ServiceNumber} onChange={e => setOnboardingForm(p => ({ ...p, ServiceNumber: e.target.value }))} />
                </label>
                <label className="plan-field">
                  <span>Initial Role</span>
                  <select className="plan-select" value={onboardingForm.Role} onChange={e => setOnboardingForm(p => ({ ...p, Role: e.target.value }))}>
                    {roles.map(r => <option key={r.RoleId} value={r.RoleName}>{r.RoleName}</option>)}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <label className="plan-field">
                  <span>Organizational Unit</span>
                  <select className="plan-select" required value={onboardingForm.UnitId} onChange={e => setOnboardingForm(p => ({ ...p, UnitId: e.target.value }))}>
                    <option value="">Select Unit</option>
                    {units.map(u => <option key={u.UnitId} value={u.UnitId}>{u.UnitName} ({u.UnitCode})</option>)}
                  </select>
                </label>
                <label className="plan-field">
                  <span>Initial Password</span>
                  <input type="password" className="plan-input" required value={onboardingForm.Password} onChange={e => setOnboardingForm(p => ({ ...p, Password: e.target.value }))} />
                </label>
              </div>

              <div className="plan-actions" style={{ marginTop: '12px' }}>
                <button type="submit" className="plan-button" disabled={isLoading}>
                  {isLoading ? 'Creating Identity...' : 'Complete Onboarding'}
                </button>
              </div>
            </form>
          </article>
        )}
      </div>
    </section>
  );
};
