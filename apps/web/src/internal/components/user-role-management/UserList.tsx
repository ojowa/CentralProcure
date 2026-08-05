'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { InternalUserProfile, InternalRoleRecord } from '../../types/internal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 'all'] as const;

interface UserListProps {
  users: InternalUserProfile[];
  roles: InternalRoleRecord[];
  isLoading: boolean;
  onRoleChange: (userId: string, newRole: string) => void | Promise<void>;
  onScheduleRole: (user: InternalUserProfile) => void;
  onEditUser: (user: InternalUserProfile) => void;
  onResetPassword: (user: InternalUserProfile) => void;
  onViewHistory: (user: InternalUserProfile) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  roles,
  isLoading,
  onRoleChange,
  onScheduleRole,
  onEditUser,
  onResetPassword,
  onViewHistory,
  searchQuery,
  onSearchChange
}) => {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const roleLabelMap = useMemo(
    () => new Map(
      roles
        .filter((role) => role.CanonicalRoleKey)
        .map((role) => [role.CanonicalRoleKey as string, role.RoleName])
    ),
    [roles]
  );
  const getRoleDisplayName = (user: InternalUserProfile) =>
    (user.CanonicalRoleKey ? roleLabelMap.get(user.CanonicalRoleKey) : null) ?? user.RoleName;

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const totalItems = users.length;
  const effectivePageSize = pageSize === 'all' ? Math.max(totalItems, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = totalItems === 0 ? 0 : (safePage - 1) * effectivePageSize + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(safePage * effectivePageSize, totalItems);
  const pagedUsers = useMemo(
    () => users.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize),
    [users, safePage, effectivePageSize]
  );

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (isLoading) return;
    await onRoleChange(userId, newRole);
  };

  return (
    <article className="portal-module-card">
      <div className="plan-toolbar" style={{ marginBottom: '20px' }}>
        <div className="plan-filters">
          <label className="plan-field" style={{ width: '400px' }}>
            <span>Search Directory</span>
            <input
              className="plan-input"
              placeholder="Search by name, email, or service number..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
            />
          </label>
          <label className="plan-field" style={{ width: '160px' }}>
            <span>Rows Per Page</span>
            <select
              className="plan-input"
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(
                  event.target.value === 'all'
                    ? 'all'
                    : Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]
                );
              }}
              disabled={isLoading}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All' : option}
                </option>
              ))}
            </select>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="plan-empty">No users found.</td>
              </tr>
            ) : (
              pagedUsers.map(user => (
                <React.Fragment key={user.InternalUserId}>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.FirstName} {user.Surname}</div>
                      <div className="plan-muted">{user.Email}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--portal-slate)' }}>
                        @{user.Username}
                      </div>
                    </td>
                    <td>
                      <div>{user.ServiceNumber}</div>
                      <div className="plan-muted" style={{ fontSize: '0.75rem' }}>
                        Last Login: {user.LastLogin ? new Date(user.LastLogin).toLocaleDateString() : 'Never'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          className="plan-select"
                          style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                          value={user.RoleName}
                          onChange={e => handleRoleChange(user.InternalUserId, e.target.value)}
                          disabled={isLoading}
                        >
                          {roles.map(r => (
                            <option key={r.RoleId} value={r.RoleName}>{r.RoleName}</option>
                          ))}
                        </select>
                        <button 
                          type="button" 
                          className="plan-button plan-button--secondary" 
                          style={{ padding: '4px', fontSize: '0.65rem' }}
                          title="Schedule/Configure Role"
                          onClick={() => onScheduleRole(user)}
                          disabled={isLoading}
                        >
                          ⚙️
                        </button>
                      </div>
                      <div className="plan-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                        {getRoleDisplayName(user)}
                      </div>
                      {(user.RoleEffectiveFrom || user.RoleExpiresAt) && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--portal-accent)', marginTop: '2px', fontWeight: 600 }}>
                          🗓️ Scheduled
                        </div>
                      )}
                      <div className="plan-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                        {user.UnitName || 'No Unit'}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`admin-status ${user.Status === 'Active' ? 'admin-status--good' : 'admin-status--warn'}`}
                      >
                        {user.Status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="plan-button plan-button--secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() => setExpandedUser(expandedUser === user.InternalUserId ? null : user.InternalUserId)}
                        >
                          {expandedUser === user.InternalUserId ? 'Hide' : 'Actions'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedUser === user.InternalUserId && (
                    <tr>
                      <td colSpan={5}>
                        <div
                          style={{
                            padding: '16px',
                            background: 'var(--portal-bg)',
                            borderRadius: '8px',
                            display: 'flex',
                            gap: '12px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <button
                            type="button"
                            className="plan-button plan-button--secondary"
                            onClick={() => onEditUser(user)}
                            disabled={isLoading}
                          >
                            Edit User
                          </button>
                          <button
                            type="button"
                            className="plan-button plan-button--secondary"
                            onClick={() => onResetPassword(user)}
                            disabled={isLoading}
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            className="plan-button plan-button--secondary"
                            onClick={() => onViewHistory(user)}
                            disabled={isLoading}
                          >
                            View Role History
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {users.length > 0 ? (
        <div className="plan-pagination" style={{ marginTop: '16px' }}>
          <span className="plan-pagination__meta">
            Showing {pageStart} - {pageEnd} of {totalItems}
          </span>
          <div className="plan-pagination__controls">
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={() => setPage(Math.max(safePage - 1, 1))}
              disabled={safePage === 1 || isLoading}
            >
              Previous
            </button>
            <span className="plan-muted">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={() => setPage(Math.min(safePage + 1, totalPages))}
              disabled={safePage >= totalPages || isLoading}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
};
