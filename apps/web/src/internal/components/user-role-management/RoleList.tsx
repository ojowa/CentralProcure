'use client';

import React, { useState } from 'react';
import type { InternalRoleRecord, InternalUserProfile } from '../../types/internal';

interface RoleListProps {
  roles: InternalRoleRecord[];
  users: InternalUserProfile[];
  isLoading: boolean;
  onEditRole: (role: InternalRoleRecord) => void;
  onCreateRole: () => void;
  onDeactivateRole: (role: InternalRoleRecord) => void;
}

export const RoleList: React.FC<RoleListProps> = ({
  roles,
  users,
  isLoading,
  onEditRole,
  onCreateRole,
  onDeactivateRole
}) => {
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const roleLabelMap = new Map(
    roles
      .filter((role) => role.CanonicalRoleKey)
      .map((role) => [role.CanonicalRoleKey as string, role.RoleName])
  );

  const getRoleDisplayName = (role: InternalRoleRecord) =>
    (role.CanonicalRoleKey ? roleLabelMap.get(role.CanonicalRoleKey) : null) ?? role.RoleName;

  const getUserCount = (roleName: string) => {
    return users.filter(u => u.RoleName === roleName).length;
  };

  const getUsersForRole = (roleName: string) => {
    return users.filter(u => u.RoleName === roleName);
  };

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="plan-button"
          onClick={onCreateRole}
          disabled={isLoading}
        >
          + Create New Role
        </button>
      </div>

      <div
        className="roles-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}
      >
        {roles.length === 0 ? (
          <div className="plan-empty" style={{ gridColumn: '1 / -1' }}>No roles defined.</div>
        ) : (
          roles.map(role => {
            const userCount = getUserCount(role.RoleName);
            const isExpanded = expandedRole === role.RoleId;

            return (
              <article key={role.RoleId} className="portal-module-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0 }}>{getRoleDisplayName(role)}</h3>
                  <span
                    className={`admin-status ${role.IsActive ? 'admin-status--good' : ''}`}
                  >
                    {role.IsActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                {getRoleDisplayName(role) !== role.RoleName ? (
                  <p className="plan-muted" style={{ marginTop: '6px', fontSize: '0.75rem' }}>
                    API role: {role.RoleName}
                  </p>
                ) : null}
                <p className="plan-muted" style={{ marginTop: '12px', fontSize: '0.875rem' }}>
                  {role.Description || 'No description provided for this statutory role.'}
                </p>
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--portal-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--portal-slate)' }}>
                    Users Assigned: <strong>{userCount}</strong>
                  </div>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="plan-button plan-button--secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                    onClick={() => onEditRole(role)}
                    disabled={isLoading}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="plan-button plan-button--secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                    onClick={() => setExpandedRole(isExpanded ? null : role.RoleId)}
                  >
                    {isExpanded ? 'Hide Users' : 'View Users'}
                  </button>
                  {role.IsActive && userCount === 0 && (
                    <button
                      type="button"
                      className="plan-button"
                      style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                      onClick={() => onDeactivateRole(role)}
                      disabled={isLoading}
                    >
                      Deactivate
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px',
                      background: 'var(--portal-bg)',
                      borderRadius: '6px'
                    }}
                  >
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem' }}>Users with this role:</h4>
                    {getUsersForRole(role.RoleName).length === 0 ? (
                      <p className="plan-muted" style={{ fontSize: '0.75rem', margin: 0 }}>
                        No users assigned to this role.
                      </p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.75rem' }}>
                        {getUsersForRole(role.RoleName).map(user => (
                          <li key={user.InternalUserId}>
                            {user.FirstName} {user.Surname} ({user.Email})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
