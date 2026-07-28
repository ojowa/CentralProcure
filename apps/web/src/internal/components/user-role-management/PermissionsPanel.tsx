'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { InternalRoleRecord, Permission, RolePermission } from '../../types/internal';
import { fetchAllPermissions, fetchRolePermissions, upsertRolePermission, deleteRolePermission } from '../../services/permissionService';

interface PermissionsPanelProps {
  roles: InternalRoleRecord[];
  token?: string | null;
}

type PermissionModule = {
  module: string;
  permissions: Permission[];
};

export const PermissionsPanel: React.FC<PermissionsPanelProps> = ({ roles, token }) => {
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.RoleName ?? '');
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [perms, rolePermsData] = await Promise.all([
        fetchAllPermissions(token),
        fetchRolePermissions(token, selectedRole),
      ]);
      setAllPermissions(perms);
      setRolePerms(rolePermsData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load permissions';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const rolePermKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const rp of rolePerms) {
      if (rp.IsEnabled) keys.add(rp.PermissionKey);
    }
    return keys;
  }, [rolePerms]);

  const groupedPermissions = useMemo((): PermissionModule[] => {
    const moduleMap = new Map<string, Permission[]>();
    const filtered = query
      ? allPermissions.filter(p =>
          p.PermissionKey.toLowerCase().includes(query.toLowerCase()) ||
          p.Module.toLowerCase().includes(query.toLowerCase()) ||
          p.Action.toLowerCase().includes(query.toLowerCase()) ||
          (p.Description ?? '').toLowerCase().includes(query.toLowerCase())
        )
      : allPermissions;

    for (const perm of filtered) {
      if (!moduleMap.has(perm.Module)) moduleMap.set(perm.Module, []);
      moduleMap.get(perm.Module)!.push(perm);
    }

    return Array.from(moduleMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([module, permissions]) => ({ module, permissions: permissions.sort((a, b) => a.Action.localeCompare(b.Action)) }));
  }, [allPermissions, query]);

  const handleToggle = useCallback(async (permissionKey: string, currentEnabled: boolean) => {
    if (!token || !selectedRole || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      if (currentEnabled) {
        await deleteRolePermission(token, selectedRole, permissionKey);
      } else {
        await upsertRolePermission(token, selectedRole, permissionKey, true);
      }
      setRolePerms(prev => {
        if (currentEnabled) {
          return prev.filter(rp => rp.PermissionKey !== permissionKey);
        } else {
          const perm = allPermissions.find(p => p.PermissionKey === permissionKey);
          return [...prev, {
            RoleName: selectedRole,
            PermissionKey: permissionKey,
            Module: perm?.Module ?? '',
            Action: perm?.Action ?? '',
            Description: perm?.Description ?? null,
            IsEnabled: true,
          }];
        }
      });
      setSuccess(currentEnabled ? 'Permission removed' : 'Permission granted');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update permission';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }, [token, selectedRole, isSaving, allPermissions]);

  const totalEnabled = rolePermKeys.size;
  const totalPermissions = allPermissions.length;

  if (isLoading) {
    return <div className="plan-loading">Loading permissions...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Role Permissions</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
            Configure fine-grained permissions for each role. {totalEnabled} of {totalPermissions} permissions enabled.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '180px' }}
          >
            {roles.filter(r => r.IsActive).map(r => (
              <option key={r.RoleName} value={r.RoleName}>{r.RoleName}</option>
            ))}
          </select>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search permissions..."
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', width: '200px' }}
          />
        </div>
      </div>

      {error && <div className="portal-alert" style={{ marginBottom: '12px' }}>{error}</div>}
      {success && <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#d1fae5', color: '#065f46', borderRadius: '6px', fontSize: '13px' }}>{success}</div>}

      {isSaving && (
        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#6b7280' }}>Saving...</div>
      )}

      {groupedPermissions.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '8px' }}>
          {query ? 'No permissions match your search.' : 'No permissions found.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupedPermissions.map(({ module, permissions: perms }) => {
            const enabledCount = perms.filter(p => rolePermKeys.has(p.PermissionKey)).length;
            return (
              <div key={module} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', textTransform: 'capitalize' }}>{module.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{enabledCount}/{perms.length}</span>
                </div>
                <div style={{ padding: '8px 14px' }}>
                  {perms.map(perm => {
                    const isEnabled = rolePermKeys.has(perm.PermissionKey);
                    return (
                      <div
                        key={perm.PermissionKey}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 0',
                          borderBottom: '1px solid #f3f4f6',
                          opacity: isSaving ? 0.6 : 1,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500 }}>
                            <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                              {perm.Action}
                            </code>
                          </div>
                          {perm.Description && (
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{perm.Description}</div>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggle(perm.PermissionKey, isEnabled)}
                          disabled={isSaving}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            background: isEnabled ? '#dc2626' : '#16a34a',
                            color: '#fff',
                            minWidth: '70px',
                          }}
                        >
                          {isEnabled ? 'Revoke' : 'Grant'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
