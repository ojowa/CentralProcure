'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { InternalRoleRecord, Permission, RolePermission } from '../../types/internal';
import {
  fetchAllPermissions,
  fetchRolePermissions,
  upsertRolePermission,
  deleteRolePermission,
} from '../../services/permissionService';

interface PermissionsPanelProps {
  roles: InternalRoleRecord[];
  token?: string | null;
}

type PermissionModule = {
  module: string;
  permissions: Permission[];
  enabledCount: number;
  totalCount: number;
};

type ViewMode = 'manage' | 'compare';

export const PermissionsPanel: React.FC<PermissionsPanelProps> = ({ roles, token }) => {
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.RoleName ?? '');
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('manage');

  // Compare mode state
  const [compareRole, setCompareRole] = useState<string>('');
  const [compareRolePerms, setCompareRolePerms] = useState<RolePermission[]>([]);

  // Clone mode state
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneSourceRole, setCloneSourceRole] = useState<string>('');

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

  // Load compare role permissions
  useEffect(() => {
    if (viewMode !== 'compare' || !compareRole || !token) {
      setCompareRolePerms([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRolePermissions(token, compareRole);
        if (!cancelled) setCompareRolePerms(data);
      } catch {
        if (!cancelled) setCompareRolePerms([]);
      }
    })();
    return () => { cancelled = true; };
  }, [viewMode, compareRole, token]);

  const rolePermKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const rp of rolePerms) {
      if (rp.IsEnabled) keys.add(rp.PermissionKey);
    }
    return keys;
  }, [rolePerms]);

  const comparePermKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const rp of compareRolePerms) {
      if (rp.IsEnabled) keys.add(rp.PermissionKey);
    }
    return keys;
  }, [compareRolePerms]);

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
      .map(([module, permissions]) => {
        const sorted = permissions.sort((a, b) => a.Action.localeCompare(b.Action));
        const enabledCount = sorted.filter(p => rolePermKeys.has(p.PermissionKey)).length;
        return { module, permissions: sorted, enabledCount, totalCount: sorted.length };
      });
  }, [allPermissions, query, rolePermKeys]);

  const totalEnabled = rolePermKeys.size;
  const totalPermissions = allPermissions.length;
  const overallPercent = totalPermissions > 0 ? Math.round((totalEnabled / totalPermissions) * 100) : 0;

  const toggleModule = useCallback((module: string) => {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedModules(new Set(groupedPermissions.map(g => g.module)));
  }, [groupedPermissions]);

  const expandAll = useCallback(() => {
    setCollapsedModules(new Set());
  }, []);

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

  const handleBulkToggle = useCallback(async (modulePerms: Permission[], grantAll: boolean) => {
    if (!token || !selectedRole || isSaving) return;
    setIsSaving(true);
    setError(null);

    const ops = modulePerms.map(async perm => {
      const isEnabled = rolePermKeys.has(perm.PermissionKey);
      if (grantAll && !isEnabled) {
        await upsertRolePermission(token, selectedRole, perm.PermissionKey, true);
        return { key: perm.PermissionKey, added: true };
      } else if (!grantAll && isEnabled) {
        await deleteRolePermission(token, selectedRole, perm.PermissionKey);
        return { key: perm.PermissionKey, added: false, removed: true };
      }
      return null;
    });

    try {
      await Promise.all(ops);
      // Refresh role perms
      const updated = await fetchRolePermissions(token, selectedRole);
      setRolePerms(updated);
      setSuccess(grantAll ? 'All permissions granted for module' : 'All permissions revoked for module');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bulk update failed';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }, [token, selectedRole, isSaving, rolePermKeys]);

  const handleClonePermissions = useCallback(async () => {
    if (!token || !selectedRole || !cloneSourceRole || cloneSourceRole === selectedRole || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      // Get source role permissions
      const sourcePerms = await fetchRolePermissions(token, cloneSourceRole);
      const sourceEnabled = sourcePerms.filter(rp => rp.IsEnabled);

      // Grant all source permissions to target role
      await Promise.all(
        sourceEnabled.map(rp => upsertRolePermission(token, selectedRole, rp.PermissionKey, true))
      );

      // Refresh
      const updated = await fetchRolePermissions(token, selectedRole);
      setRolePerms(updated);
      setShowCloneDialog(false);
      setSuccess(`Permissions cloned from "${cloneSourceRole}"`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Clone failed';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }, [token, selectedRole, cloneSourceRole, isSaving]);

  if (isLoading) {
    return <div className="plan-loading">Loading permissions...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Role Permissions</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
            Configure fine-grained permissions for each role. {totalEnabled} of {totalPermissions} enabled ({overallPercent}%).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', borderRadius: '6px', border: '1px solid #d1d5db', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('manage')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer',
                background: viewMode === 'manage' ? '#2563eb' : '#fff',
                color: viewMode === 'manage' ? '#fff' : '#374151',
              }}
            >
              Manage
            </button>
            <button
              onClick={() => setViewMode('compare')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 500, border: 'none', borderLeft: '1px solid #d1d5db', cursor: 'pointer',
                background: viewMode === 'compare' ? '#2563eb' : '#fff',
                color: viewMode === 'compare' ? '#fff' : '#374151',
              }}
            >
              Compare
            </button>
          </div>

          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '180px' }}
          >
            {roles.filter(r => r.IsActive).map(r => (
              <option key={r.RoleName} value={r.RoleName}>{r.RoleName}</option>
            ))}
          </select>

          {viewMode === 'manage' && (
            <>
              <button
                onClick={() => setShowCloneDialog(true)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px',
                  fontWeight: 500, cursor: 'pointer', background: '#fff', color: '#374151',
                }}
              >
                Clone From...
              </button>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search permissions..."
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', width: '200px' }}
              />
            </>
          )}

          {viewMode === 'compare' && (
            <select
              value={compareRole}
              onChange={e => setCompareRole(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '180px' }}
            >
              <option value="">-- Compare with --</option>
              {roles.filter(r => r.IsActive && r.RoleName !== selectedRole).map(r => (
                <option key={r.RoleName} value={r.RoleName}>{r.RoleName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      <div style={{ marginBottom: '16px', background: '#f3f4f6', borderRadius: '8px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Overall: {totalEnabled}/{totalPermissions}</span>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>{overallPercent}%</span>
        </div>
        <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${overallPercent}%`, background: overallPercent === 100 ? '#16a34a' : '#2563eb', borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {error && <div className="portal-alert" style={{ marginBottom: '12px' }}>{error}</div>}
      {success && <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#d1fae5', color: '#065f46', borderRadius: '6px', fontSize: '13px' }}>{success}</div>}
      {isSaving && <div style={{ marginBottom: '8px', fontSize: '12px', color: '#6b7280' }}>Saving...</div>}

      {/* Clone Dialog */}
      {showCloneDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600 }}>Clone Permissions</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
              Copy all enabled permissions from another role to <strong>{selectedRole}</strong>.
            </p>
            <select
              value={cloneSourceRole}
              onChange={e => setCloneSourceRole(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', marginBottom: '16px' }}
            >
              <option value="">-- Select source role --</option>
              {roles.filter(r => r.IsActive && r.RoleName !== selectedRole).map(r => (
                <option key={r.RoleName} value={r.RoleName}>{r.RoleName}</option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => { setShowCloneDialog(false); setCloneSourceRole(''); }}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', cursor: 'pointer', background: '#fff' }}
              >
                Cancel
              </button>
              <button
                onClick={handleClonePermissions}
                disabled={!cloneSourceRole || cloneSourceRole === selectedRole || isSaving}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 500,
                  cursor: !cloneSourceRole || cloneSourceRole === selectedRole || isSaving ? 'not-allowed' : 'pointer',
                  background: !cloneSourceRole || cloneSourceRole === selectedRole ? '#d1d5db' : '#2563eb',
                  color: '#fff',
                }}
              >
                {isSaving ? 'Cloning...' : 'Clone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions list */}
      {groupedPermissions.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '8px' }}>
          {query ? 'No permissions match your search.' : 'No permissions found.'}
        </div>
      ) : (
        <>
          {viewMode === 'manage' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
              <button onClick={expandAll} style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Expand All</button>
              <button onClick={collapseAll} style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Collapse All</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {groupedPermissions.map(({ module, permissions: perms, enabledCount, totalCount }) => {
              const isCollapsed = collapsedModules.has(module);
              const modulePercent = totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0;

              return (
                <div key={module} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  {/* Module header - clickable */}
                  <div
                    onClick={() => toggleModule(module)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', background: '#f9fafb', borderBottom: isCollapsed ? 'none' : '1px solid #e5e7eb',
                      cursor: 'pointer', userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <span style={{ fontSize: '12px', color: '#6b7280', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                        &#9660;
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '14px', textTransform: 'capitalize' }}>{module.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {viewMode === 'manage' && (
                        <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleBulkToggle(perms, true)}
                            disabled={isSaving || enabledCount === totalCount}
                            style={{
                              padding: '3px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '11px',
                              cursor: isSaving || enabledCount === totalCount ? 'not-allowed' : 'pointer',
                              background: enabledCount === totalCount ? '#f3f4f6' : '#fff',
                              color: enabledCount === totalCount ? '#9ca3af' : '#16a34a',
                            }}
                          >
                            Grant All
                          </button>
                          <button
                            onClick={() => handleBulkToggle(perms, false)}
                            disabled={isSaving || enabledCount === 0}
                            style={{
                              padding: '3px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '11px',
                              cursor: isSaving || enabledCount === 0 ? 'not-allowed' : 'pointer',
                              background: enabledCount === 0 ? '#f3f4f6' : '#fff',
                              color: enabledCount === 0 ? '#9ca3af' : '#dc2626',
                            }}
                          >
                            Revoke All
                          </button>
                        </div>
                      )}
                      {/* Progress bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px' }}>
                        <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${modulePercent}%`, background: modulePercent === 100 ? '#16a34a' : modulePercent > 0 ? '#2563eb' : '#e5e7eb', borderRadius: '3px', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{enabledCount}/{totalCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Permissions rows */}
                  {!isCollapsed && (
                    <div style={{ padding: '4px 14px' }}>
                      {viewMode === 'manage' ? (
                        perms.map(perm => {
                          const isEnabled = rolePermKeys.has(perm.PermissionKey);
                          return (
                            <div
                              key={perm.PermissionKey}
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 0', borderBottom: '1px solid #f3f4f6',
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
                                  padding: '4px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 500,
                                  cursor: isSaving ? 'not-allowed' : 'pointer',
                                  background: isEnabled ? '#dc2626' : '#16a34a', color: '#fff', minWidth: '70px',
                                }}
                              >
                                {isEnabled ? 'Revoke' : 'Grant'}
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        /* Compare mode */
                        perms.map(perm => {
                          const inSelected = rolePermKeys.has(perm.PermissionKey);
                          const inCompare = comparePermKeys.has(perm.PermissionKey);
                          const isSame = inSelected === inCompare;
                          let statusLabel = 'Same';
                          let statusColor = '#6b7280';
                          let statusBg = '#f3f4f6';
                          if (!isSame) {
                            if (inSelected && !inCompare) {
                              statusLabel = `Only in ${selectedRole}`;
                              statusColor = '#1d4ed8';
                              statusBg = '#dbeafe';
                            } else {
                              statusLabel = `Only in ${compareRole}`;
                              statusColor = '#9333ea';
                              statusBg = '#f3e8ff';
                            }
                          }
                          return (
                            <div
                              key={perm.PermissionKey}
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 0', borderBottom: '1px solid #f3f4f6', gap: '12px',
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
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{
                                  fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px',
                                  background: inSelected ? '#dcfce7' : '#fee2e2',
                                  color: inSelected ? '#166534' : '#991b1b',
                                }}>
                                  {selectedRole}: {inSelected ? 'Yes' : 'No'}
                                </span>
                                {compareRole && (
                                  <span style={{
                                    fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px',
                                    background: inCompare ? '#dcfce7' : '#fee2e2',
                                    color: inCompare ? '#166534' : '#991b1b',
                                  }}>
                                    {compareRole}: {inCompare ? 'Yes' : 'No'}
                                  </span>
                                )}
                                {!isSame && (
                                  <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px', background: statusBg, color: statusColor }}>
                                    {statusLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
