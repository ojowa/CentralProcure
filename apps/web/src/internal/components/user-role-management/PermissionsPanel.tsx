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

  const [compareRole, setCompareRole] = useState<string>('');
  const [compareRolePerms, setCompareRolePerms] = useState<RolePermission[]>([]);

  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneSourceRole, setCloneSourceRole] = useState<string>('');
  const [clonePreview, setClonePreview] = useState<{ toAdd: number; alreadyExist: number } | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedRole]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

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
    for (const rp of rolePerms) { if (rp.IsEnabled) keys.add(rp.PermissionKey); }
    return keys;
  }, [rolePerms]);

  const comparePermKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const rp of compareRolePerms) { if (rp.IsEnabled) keys.add(rp.PermissionKey); }
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
            RoleName: selectedRole, PermissionKey: permissionKey,
            Module: perm?.Module ?? '', Action: perm?.Action ?? '',
            Description: perm?.Description ?? null, IsEnabled: true,
          }];
        }
      });
      setSuccess(currentEnabled ? 'Permission removed' : 'Permission granted');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update permission');
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
      const updated = await fetchRolePermissions(token, selectedRole);
      setRolePerms(updated);
      setSuccess(grantAll ? 'All permissions granted for module' : 'All permissions revoked for module');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setIsSaving(false);
    }
  }, [token, selectedRole, isSaving, rolePermKeys]);

  const handleClonePermissions = useCallback(async () => {
    if (!token || !selectedRole || !cloneSourceRole || cloneSourceRole === selectedRole || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const sourcePerms = await fetchRolePermissions(token, cloneSourceRole);
      const sourceEnabled = sourcePerms.filter(rp => rp.IsEnabled);
      await Promise.all(sourceEnabled.map(rp => upsertRolePermission(token, selectedRole, rp.PermissionKey, true)));
      const updated = await fetchRolePermissions(token, selectedRole);
      setRolePerms(updated);
      setShowCloneDialog(false);
      setCloneSourceRole('');
      setClonePreview(null);
      setSuccess(`Permissions cloned from "${cloneSourceRole}"`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Clone failed');
    } finally {
      setIsSaving(false);
    }
  }, [token, selectedRole, cloneSourceRole, isSaving]);

  const getBarClass = (pct: number) =>
    pct === 100 ? 'perm-panel__bar-fill perm-panel__bar-fill--full'
    : pct > 0 ? 'perm-panel__bar-fill perm-panel__bar-fill--partial'
    : 'perm-panel__bar-fill perm-panel__bar-fill--empty';

  if (isLoading) {
    return <div className="plan-loading">Loading permissions...</div>;
  }

  return (
    <div className="perm-panel">
      <div className="perm-panel__header">
        <div>
          <h3 className="perm-panel__title">Role Permissions</h3>
          <p className="perm-panel__subtitle">
            Configure fine-grained permissions for each role. {totalEnabled} of {totalPermissions} enabled ({overallPercent}%).
          </p>
        </div>
        <div className="perm-panel__controls">
          <div className="perm-panel__mode-toggle">
            <button
              className={`perm-panel__mode-btn ${viewMode === 'manage' ? 'perm-panel__mode-btn--active' : ''}`}
              onClick={() => setViewMode('manage')}
            >Manage</button>
            <button
              className={`perm-panel__mode-btn ${viewMode === 'compare' ? 'perm-panel__mode-btn--active' : ''}`}
              onClick={() => setViewMode('compare')}
            >Compare</button>
          </div>

          <select className="perm-panel__role-select" value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
            {roles.filter(r => r.IsActive).map(r => (
              <option key={r.RoleName} value={r.RoleName}>{r.RoleName}</option>
            ))}
          </select>

          {viewMode === 'manage' && (
            <>
              <button className="perm-panel__clone-btn" onClick={() => setShowCloneDialog(true)}>Clone From...</button>
              <input className="perm-panel__search" type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search permissions..." />
            </>
          )}

          {viewMode === 'compare' && (
            <select className="perm-panel__compare-select" value={compareRole} onChange={e => setCompareRole(e.target.value)}>
              <option value="">-- Compare with --</option>
              {roles.filter(r => r.IsActive && r.RoleName !== selectedRole).map(r => (
                <option key={r.RoleName} value={r.RoleName}>{r.RoleName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="perm-panel__overall">
        <div className="perm-panel__overall-header">
          <span className="perm-panel__overall-label">Overall: {totalEnabled}/{totalPermissions}</span>
          <span className="perm-panel__overall-pct">{overallPercent}%</span>
        </div>
        <div className="perm-panel__bar-track">
          <div className={getBarClass(overallPercent)} style={{ width: `${overallPercent}%` }} />
        </div>
      </div>

      {error && <div className="portal-alert" style={{ marginBottom: '12px' }}>{error}</div>}
      {success && <div className="perm-panel__success">{success}</div>}
      {isSaving && <div className="perm-panel__saving">Saving...</div>}

      {showCloneDialog && (
        <div className="portal-modal-overlay">
          <div className="portal-modal-container" style={{ width: '420px', maxWidth: '90vw' }}>
            <header className="portal-modal-header">
              <h3>Clone Permissions</h3>
              <button type="button" className="portal-modal-close" onClick={() => { setShowCloneDialog(false); setCloneSourceRole(''); setClonePreview(null); }}>&times;</button>
            </header>
            <div className="portal-modal-body">
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--portal-slate)' }}>
                Copy all enabled permissions from another role to <strong>{selectedRole}</strong>.
              </p>
              <select
                className="perm-panel__role-select"
                style={{ width: '100%', marginBottom: '16px' }}
                value={cloneSourceRole}
                onChange={e => {
                  const val = e.target.value;
                  setCloneSourceRole(val);
                  if (val && token) {
                    fetchRolePermissions(token, val).then(sourcePerms => {
                      const sourceEnabled = sourcePerms.filter(rp => rp.IsEnabled);
                      const toAdd = sourceEnabled.filter(rp => !rolePermKeys.has(rp.PermissionKey)).length;
                      setClonePreview({ toAdd, alreadyExist: sourceEnabled.length - toAdd });
                    }).catch(() => setClonePreview(null));
                  } else {
                    setClonePreview(null);
                  }
                }}
              >
                <option value="">-- Select source role --</option>
                {roles.filter(r => r.IsActive && r.RoleName !== selectedRole).map(r => (
                  <option key={r.RoleName} value={r.RoleName}>{r.RoleName}</option>
                ))}
              </select>
              {clonePreview && (
                <div className="perm-panel__clone-preview" style={{ marginBottom: '16px', padding: '10px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '13px' }}>
                  <strong>{clonePreview.toAdd}</strong> permission{clonePreview.toAdd === 1 ? '' : 's'} will be added
                  {clonePreview.alreadyExist > 0 && <>, <strong>{clonePreview.alreadyExist}</strong> already granted</>}.
                </div>
              )}
            </div>
            <footer className="portal-modal-footer">
              <button type="button" className="plan-button plan-button--secondary" onClick={() => { setShowCloneDialog(false); setCloneSourceRole(''); setClonePreview(null); }} disabled={isSaving}>Cancel</button>
              <button type="button" className="plan-button" onClick={() => void handleClonePermissions()} disabled={!cloneSourceRole || cloneSourceRole === selectedRole || isSaving}>
                {isSaving ? 'Cloning...' : 'Clone'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {groupedPermissions.length === 0 ? (
        <div className="perm-panel__empty">
          {query ? 'No permissions match your search.' : 'No permissions found.'}
        </div>
      ) : (
        <>
          {viewMode === 'manage' && (
            <div className="perm-panel__expand-controls">
              <button className="perm-panel__expand-btn" onClick={expandAll}>Expand All</button>
              <button className="perm-panel__expand-btn" onClick={collapseAll}>Collapse All</button>
            </div>
          )}

          <div className="perm-panel__module-list">
            {groupedPermissions.map(({ module, permissions: perms, enabledCount, totalCount }) => {
              const isCollapsed = collapsedModules.has(module);
              const modulePercent = totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0;

              return (
                <div key={module} className="perm-panel__module">
                  <div
                    className={`perm-panel__module-header ${isCollapsed ? 'perm-panel__module-header--collapsed' : ''}`}
                    onClick={() => toggleModule(module)}
                  >
                    <div className="perm-panel__module-title-group">
                      <span className={`perm-panel__module-chevron ${isCollapsed ? 'perm-panel__module-chevron--collapsed' : ''}`}>&#9660;</span>
                      <span className="perm-panel__module-name">{module.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="perm-panel__module-actions">
                      {viewMode === 'manage' && (
                        <div className="perm-panel__bulk-btns" onClick={e => e.stopPropagation()}>
                          <button
                            className={`perm-panel__bulk-btn perm-panel__bulk-btn--grant ${isSaving || enabledCount === totalCount ? 'perm-panel__bulk-btn--disabled' : ''}`}
                            onClick={() => handleBulkToggle(perms, true)}
                            disabled={isSaving || enabledCount === totalCount}
                          >Grant All</button>
                          <button
                            className={`perm-panel__bulk-btn perm-panel__bulk-btn--revoke ${isSaving || enabledCount === 0 ? 'perm-panel__bulk-btn--disabled' : ''}`}
                            onClick={() => handleBulkToggle(perms, false)}
                            disabled={isSaving || enabledCount === 0}
                          >Revoke All</button>
                        </div>
                      )}
                      <div className="perm-panel__module-progress">
                        <div className="perm-panel__module-bar-track">
                          <div className={getBarClass(modulePercent)} style={{ width: `${modulePercent}%` }} />
                        </div>
                        <span className="perm-panel__module-count">{enabledCount}/{totalCount}</span>
                      </div>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="perm-panel__perm-rows">
                      {viewMode === 'manage' ? (
                        perms.map(perm => {
                          const isEnabled = rolePermKeys.has(perm.PermissionKey);
                          return (
                            <div key={perm.PermissionKey} className={`perm-panel__perm-row ${isSaving ? 'perm-panel__perm-row--saving' : ''}`}>
                              <div className="perm-panel__perm-info">
                                <div className="perm-panel__perm-action">
                                  <code className="perm-panel__perm-code">{perm.Action}</code>
                                </div>
                                {perm.Description && <div className="perm-panel__perm-desc">{perm.Description}</div>}
                              </div>
                              <button
                                className={`perm-panel__toggle-btn ${isEnabled ? 'perm-panel__toggle-btn--revoke' : 'perm-panel__toggle-btn--grant'} ${isSaving ? 'perm-panel__toggle-btn--disabled' : ''}`}
                                onClick={() => handleToggle(perm.PermissionKey, isEnabled)}
                                disabled={isSaving}
                              >{isEnabled ? 'Revoke' : 'Grant'}</button>
                            </div>
                          );
                        })
                      ) : (
                        perms.map(perm => {
                          const inSelected = rolePermKeys.has(perm.PermissionKey);
                          const inCompare = comparePermKeys.has(perm.PermissionKey);
                          const isSame = inSelected === inCompare;
                          let badgeClass = 'perm-panel__badge perm-panel__badge--same';
                          let statusLabel = 'Same';
                          if (!isSame) {
                            if (inSelected && !inCompare) {
                              badgeClass = 'perm-panel__badge perm-panel__badge--diff';
                              statusLabel = `Only in ${selectedRole}`;
                            } else {
                              badgeClass = 'perm-panel__badge perm-panel__badge--only-compare';
                              statusLabel = `Only in ${compareRole}`;
                            }
                          }
                          return (
                            <div key={perm.PermissionKey} className="perm-panel__compare-row">
                              <div className="perm-panel__perm-info">
                                <div className="perm-panel__perm-action">
                                  <code className="perm-panel__perm-code">{perm.Action}</code>
                                </div>
                                {perm.Description && <div className="perm-panel__perm-desc">{perm.Description}</div>}
                              </div>
                              <div className="perm-panel__compare-badges">
                                <span className={`perm-panel__badge ${inSelected ? 'perm-panel__badge--yes' : 'perm-panel__badge--no'}`}>
                                  {selectedRole}: {inSelected ? 'Yes' : 'No'}
                                </span>
                                {compareRole && (
                                  <span className={`perm-panel__badge ${inCompare ? 'perm-panel__badge--yes' : 'perm-panel__badge--no'}`}>
                                    {compareRole}: {inCompare ? 'Yes' : 'No'}
                                  </span>
                                )}
                                {!isSame && <span className={badgeClass}>{statusLabel}</span>}
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
