'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type { InternalModule, InternalOrganizationalUnitRecord, InternalUserProfile } from '../types/internal';
import { fetchInternalUnits, manageInternalUnit, fetchInternalUnitStaff } from '../services/internalAuthService';
import { UnitStaffModal } from './UnitStaffModal';
import {
  Building2,
  Plus,
  Edit2,
  Search,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  ArrowLeft,
  LayoutGrid,
  Users,
  Eye,
  ToggleLeft,
  ToggleRight,
  RefreshCcw
} from 'lucide-react';

interface OrganizationManagementModuleProps {
  module: InternalModule;
  token: string;
}

const UNIT_TYPES = [
  'Executive',
  'Group',
  'Directorate',
  'SpecializedUnit',
  'Formation',
  'Command',
  'Department',
  'Unit'
];

export const OrganizationManagementModule: React.FC<OrganizationManagementModuleProps> = ({ module, token }) => {
  const [units, setUnits] = useState<InternalOrganizationalUnitRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // View State
  const [selectedUnit, setSelectedUnit] = useState<InternalOrganizationalUnitRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingStaffUnit, setViewingStaffUnit] = useState<InternalOrganizationalUnitRecord | null>(null);
  const [activeUnitTab, setActiveUnitTab] = useState<'details' | 'personnel' | 'subunits'>('details');

  // Personnel Management State
  const [allUsers, setAllUsers] = useState<InternalUserProfile[]>([]);
  const [unitStaff, setUnitStaff] = useState<InternalUserProfile[]>([]);
  const [isAssigningStaff, setIsAssigningStaff] = useState(false);

  // Form State
  const [unitName, setUnitName] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [unitType, setUnitType] = useState('Department');
  const [parentUnitId, setParentUnitId] = useState<string>('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isAssignable, setIsAssignable] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const data = await fetchInternalUnits();
      setUnits(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUnitStaff = async (unitId: string) => {
    if (!token) return;
    try {
      const staffData = await fetchInternalUnitStaff(token, unitId);
      // Map StaffRecord to UserProfile format (approximate for display)
      setUnitStaff(staffData.map(s => ({
        InternalUserId: s.InternalUserId,
        Email: s.Email,
        Username: s.Username,
        FirstName: s.FirstName,
        Surname: s.Surname,
        RoleName: s.RoleName,
        Status: s.Status,
        UnitId: unitId,
        UnitName: selectedUnit?.UnitName || '',
        ServiceNumber: '',
        CreatedAt: ''
      } as InternalUserProfile)));
    } catch (err: any) {
      console.error("Failed to load unit staff:", err);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const stats = useMemo(() => {
    return {
      total: units.length,
      active: units.filter(u => u.IsActive).length,
      formations: units.filter(u => u.UnitType === 'Formation' || u.UnitType === 'Command').length,
      departments: units.filter(u => u.UnitType === 'Department').length
    };
  }, [units]);

  const filteredUnits = useMemo(() => {

    if (!searchQuery.trim()) return units;
    const query = searchQuery.toLowerCase();
    return units.filter(
      u => u.UnitName.toLowerCase().includes(query) || 
           u.UnitCode.toLowerCase().includes(query) || 
           u.UnitType.toLowerCase().includes(query)
    );
  }, [units, searchQuery]);

  // Hierarchical grouping
  const unitTree = useMemo(() => {
    const map = new Map<string | null, InternalOrganizationalUnitRecord[]>();
    units.forEach(u => {
      const parentId = u.ParentUnitId || null;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(u);
    });
    return map;
  }, [units]);

  const handleEdit = (unit: InternalOrganizationalUnitRecord) => {
    setSelectedUnit(unit);
    setUnitName(unit.UnitName);
    setUnitCode(unit.UnitCode);
    setUnitType(unit.UnitType);
    setParentUnitId(unit.ParentUnitId || '');
    setSortOrder(unit.SortOrder);
    setIsAssignable(unit.IsAssignable);
    setIsActive(unit.IsActive);
    setIsEditing(true);
    setIsCreating(false);
    setActiveUnitTab('details');
    void loadUnitStaff(unit.UnitId);
  };

  const handleCreateNew = (parentId?: string) => {
    setSelectedUnit(null);
    setUnitName('');
    setUnitCode('');
    setUnitType('Department');
    setParentUnitId(parentId || '');
    setSortOrder(0);
    setIsAssignable(true);
    setIsActive(true);
    setIsCreating(true);
    setIsEditing(false);
    setActiveUnitTab('details');
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await manageInternalUnit(token, {
        UnitId: selectedUnit?.UnitId,
        UnitName: unitName,
        UnitCode: unitCode,
        UnitType: unitType,
        ParentUnitId: parentUnitId || undefined,
        SortOrder: sortOrder,
        IsAssignable: isAssignable,
        IsActive: isActive
      });
      setSuccessMessage(`Unit ${selectedUnit ? 'updated' : 'created'} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsEditing(false);
      setIsCreating(false);
      loadUnits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (unit: InternalOrganizationalUnitRecord) => {
    setLoading(true);
    try {
      await manageInternalUnit(token, {
        UnitId: unit.UnitId,
        UnitName: unit.UnitName,
        UnitCode: unit.UnitCode,
        UnitType: unit.UnitType,
        ParentUnitId: unit.ParentUnitId || undefined,
        SortOrder: unit.SortOrder,
        IsAssignable: unit.IsAssignable,
        IsActive: !unit.IsActive
      });
      setSuccessMessage(`Unit ${unit.IsActive ? 'deactivated' : 'activated'} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      loadUnits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderUnitRow = (unit: InternalOrganizationalUnitRecord, depth = 0) => {
    const children = unitTree.get(unit.UnitId) || [];
    return (
      <React.Fragment key={unit.UnitId}>
        <tr className={!unit.IsActive ? 'opacity-60 bg-slate-50' : ''}>
          <td style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}>
            <div className="flex items-center gap-2">
              {children.length > 0 ? <ChevronDown size={14} className="text-slate-400" /> : <div style={{ width: 14 }} />}
              <Building2 size={16} className={unit.IsActive ? "text-emerald-600" : "text-slate-400"} />
              <span className={`font-medium ${unit.IsActive ? 'text-slate-800' : 'text-slate-500 italic'}`}>
                {unit.UnitName}
                {!unit.IsActive && <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1 rounded uppercase tracking-tighter not-italic font-bold">Inactive</span>}
              </span>
            </div>
          </td>
          <td><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{unit.UnitCode}</code></td>
          <td><span className="app-badge">{unit.UnitType}</span></td>
          <td>{unit.IsAssignable ? <CheckCircle size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-slate-300" />}</td>
          <td className="app-table__cell--numeric">{unit.SortOrder}</td>
          <td>
            <div className="flex gap-2">
              <button className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleEdit(unit)} title="Manage Unit Workspace">
                <LayoutGrid size={14} />
              </button>
              <button 
                className={`app-btn app-btn--sm ${unit.IsActive ? 'app-btn--secondary' : 'app-btn--primary'}`} 
                onClick={() => handleToggleActive(unit)} 
                title={unit.IsActive ? "Deactivate Unit" : "Activate Unit"}
              >
                {unit.IsActive ? <ToggleRight size={14} className="text-emerald-600" /> : <ToggleLeft size={14} />}
              </button>
              <button className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleCreateNew(unit.UnitId)} title="Add Sub-unit">
                <Plus size={14} />
              </button>
            </div>
          </td>
        </tr>
        {children.map(child => renderUnitRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  if (isEditing || isCreating) {
    return (
      <section className="app-module animate-fade-up">
        <header className="app-module__header">
          <div className="app-module__title-group">
            <button className="app-btn app-btn--secondary app-btn--sm mb-4" onClick={() => { setIsEditing(false); setIsCreating(false); }}>
              <ArrowLeft size={16} className="mr-2" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center">
                <Building2 size={24} />
              </div>
              <div>
                <h2 className="app-module__title" style={{ marginBottom: 0 }}>{isCreating ? 'Configure New Unit' : selectedUnit?.UnitName}</h2>
                {!isCreating && <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-0.5">{selectedUnit?.UnitType} | {selectedUnit?.UnitCode}</p>}
              </div>
            </div>
          </div>
          <div className="app-module__actions">
            {activeUnitTab === 'details' && (
              <button className="app-btn app-btn--primary" onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                Save Changes
              </button>
            )}
          </div>
        </header>

        <div className="workflow-config-tabs mb-6">
          <button className={activeUnitTab === 'details' ? 'active' : ''} onClick={() => setActiveUnitTab('details')}>Unit Configuration</button>
          {!isCreating && (
            <>
              <button className={activeUnitTab === 'personnel' ? 'active' : ''} onClick={() => setActiveUnitTab('personnel')}>Staff Directory</button>
              <button className={activeUnitTab === 'subunits' ? 'active' : ''} onClick={() => setActiveUnitTab('subunits')}>Sub-units</button>
            </>
          )}
        </div>

        {error && <div className="app-alert app-alert--error mb-6">{error}</div>}

        <div className="management-viewport">
          {activeUnitTab === 'details' && (
            <div className="app-card">
              <div className="app-form-grid p-6">
                <div className="app-form-group">
                  <label className="app-form-label">Unit Name</label>
                  <input className="app-form__input" value={unitName} onChange={e => setUnitName(e.target.value)} placeholder="e.g. ICT Directorate" />
                </div>
                <div className="app-form-group">
                  <label className="app-form-label">Unit Code</label>
                  <input className="app-form__input" value={unitCode} onChange={e => setUnitCode(e.target.value.toUpperCase().replace(/\s/g, '_'))} placeholder="e.g. ICT_DIR" />
                </div>
                <div className="app-form-group">
                  <label className="app-form-label">Unit Type</label>
                  <select className="app-form__select" value={unitType} onChange={e => setUnitType(e.target.value)}>
                    {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="app-form-group">
                  <label className="app-form-label">Parent Unit</label>
                  <select className="app-form__select" value={parentUnitId} onChange={e => setParentUnitId(e.target.value)}>
                    <option value="">No Parent (Root)</option>
                    {units.filter(u => u.UnitId !== selectedUnit?.UnitId).map(u => (
                      <option key={u.UnitId} value={u.UnitId}>{u.UnitName} ({u.UnitCode})</option>
                    ))}
                  </select>
                </div>
                <div className="app-form-group">
                  <label className="app-form-label">Sort Order</label>
                  <input type="number" className="app-form__input" value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value))} />
                </div>
                <div className="app-form-group flex items-center gap-6 mt-8">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isAssignable} onChange={e => setIsAssignable(e.target.checked)} />
                    <span className="text-sm font-medium text-slate-700">Assignable to Users</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                    <span className="text-sm font-medium text-slate-700">Is Active</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeUnitTab === 'personnel' && selectedUnit && (
            <div className="app-card">
              <div className="p-0">
                <table className="app-table">
                  <thead className="bg-slate-50">
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>System Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitStaff.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-slate-400">
                          <Users size={48} className="mx-auto mb-4 opacity-10" />
                          <p>No personnel assigned to this unit.</p>
                        </td>
                      </tr>
                    ) : (
                      unitStaff.map(member => (
                        <tr key={member.InternalUserId}>
                          <td><div className="font-medium text-slate-800">{member.FirstName} {member.Surname}</div><div className="text-[10px] text-slate-400 uppercase tracking-tighter">{member.Username}</div></td>
                          <td className="text-sm text-slate-600">{member.Email}</td>
                          <td><span className="app-badge">{member.RoleName}</span></td>
                          <td><span className={`text-xs font-bold ${member.Status === 'Active' ? 'text-emerald-600' : 'text-rose-600'}`}>{member.Status}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeUnitTab === 'subunits' && selectedUnit && (
            <div className="app-card">
              <div className="p-0">
                <table className="app-table">
                  <thead className="bg-slate-50">
                    <tr>
                      <th>Sub-unit Name</th>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(unitTree.get(selectedUnit.UnitId) || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-slate-400">
                          <Building2 size={48} className="mx-auto mb-4 opacity-10" />
                          <p>This unit has no nested sub-units.</p>
                          <button className="app-btn app-btn--secondary app-btn--sm mt-4" onClick={() => handleCreateNew(selectedUnit.UnitId)}>
                            <Plus size={14} className="mr-2" /> Add First Sub-unit
                          </button>
                        </td>
                      </tr>
                    ) : (
                      (unitTree.get(selectedUnit.UnitId) || []).map(sub => (
                        <tr key={sub.UnitId}>
                          <td className="font-medium">{sub.UnitName}</td>
                          <td><code>{sub.UnitCode}</code></td>
                          <td><span className="app-badge">{sub.UnitType}</span></td>
                          <td>
                            <button className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleEdit(sub)}>Configure</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="app-module animate-fade-up">
      <header className="admin-hero" style={{ background: 'var(--portal-bg)', border: '1px solid var(--portal-border)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
        <div className="flex-1">
          <div className="admin-kicker">Administrative Control</div>
          <h2 className="app-module__title">Organization Directory</h2>
          <p className="app-module__description">Manage the hierarchical structure of NIS formations, commands, and departments.</p>
          
          <div className="flex gap-6 mt-6">
            <div className="bg-white p-3 rounded-lg border border-slate-100 flex-1">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Total Units</div>
              <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 flex-1">
              <div className="text-[10px] text-emerald-400 uppercase font-bold">Active</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 flex-1">
              <div className="text-[10px] text-blue-400 uppercase font-bold">Formations</div>
              <div className="text-2xl font-bold text-blue-600">{stats.formations}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 flex-1">
              <div className="text-[10px] text-purple-400 uppercase font-bold">Departments</div>
              <div className="text-2xl font-bold text-purple-600">{stats.departments}</div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button className="app-btn app-btn--primary" onClick={() => handleCreateNew()}>
            <Plus size={18} className="mr-2" /> Add New Unit
          </button>
          <button className="app-btn app-btn--secondary" onClick={loadUnits} disabled={loading}>
            <RefreshCcw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Sync Structure
          </button>
        </div>
      </header>

      {successMessage && <div className="app-alert app-alert--success mb-6">{successMessage}</div>}
      {error && <div className="app-alert app-alert--error mb-6">{error}</div>}

      <div className="app-search-bar mb-6">
        <div className="app-search">
          <Search size={18} className="app-search__icon" />
          <input 
            className="app-search__input" 
            placeholder="Search organizations, formations, departments..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="app-card">
        <div className="app-table-wrapper">
          <table className="app-table">
            <thead className="bg-slate-50">
              <tr>
                <th>Unit Name & Hierarchy</th>
                <th>Code</th>
                <th>Type</th>
                <th>Assignable</th>
                <th className="app-table__cell--numeric">Order</th>
                <th>Management</th>
              </tr>
            </thead>
            <tbody>
              {loading && units.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Loader2 className="animate-spin mx-auto mb-2 text-emerald-600" />
                    <p className="text-slate-500">Retrieving organization structure...</p>
                  </td>
                </tr>
              ) : searchQuery.trim() ? (
                filteredUnits.map(unit => (
                  <tr key={unit.UnitId}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-emerald-600" />
                        <span className="font-medium text-slate-800">{unit.UnitName}</span>
                      </div>
                    </td>
                    <td><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{unit.UnitCode}</code></td>
                    <td><span className="app-badge">{unit.UnitType}</span></td>
                    <td>{unit.IsAssignable ? <CheckCircle size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-slate-300" />}</td>
                    <td className="app-table__cell--numeric">{unit.SortOrder}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleEdit(unit)} title="Manage Unit Workspace">
                          <LayoutGrid size={14} />
                        </button>
                        <button 
                          className={`app-btn app-btn--sm ${unit.IsActive ? 'app-btn--secondary' : 'app-btn--primary'}`} 
                          onClick={() => handleToggleActive(unit)} 
                          title={unit.IsActive ? "Deactivate Unit" : "Activate Unit"}
                        >
                          {unit.IsActive ? <ToggleRight size={14} className="text-emerald-600" /> : <ToggleLeft size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                unitTree.get(null)?.map(rootUnit => renderUnitRow(rootUnit))
              )}
              {filteredUnits.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400">
                    <Search size={48} className="mx-auto mb-4 opacity-10" />
                    <p>No organizational units found matching your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
