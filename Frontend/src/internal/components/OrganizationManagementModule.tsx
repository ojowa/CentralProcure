'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type { InternalModule, InternalOrganizationalUnitRecord } from '../types/internal';
import { fetchInternalUnits, manageInternalUnit } from '../services/internalAuthService';
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
  LayoutGrid
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

  useEffect(() => {
    loadUnits();
  }, []);

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
    setIsActive(true); // Default to active for edits if not specified in record
    setIsEditing(true);
    setIsCreating(false);
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

  const renderUnitRow = (unit: InternalOrganizationalUnitRecord, depth = 0) => {
    const children = unitTree.get(unit.UnitId) || [];
    return (
      <React.Fragment key={unit.UnitId}>
        <tr>
          <td style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}>
            <div className="flex items-center gap-2">
              {children.length > 0 ? <ChevronDown size={14} className="text-slate-400" /> : <div style={{ width: 14 }} />}
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
              <button className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleEdit(unit)}>
                <Edit2 size={14} />
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
      <section className="app-module">
        <header className="app-module__header">
          <div className="app-module__title-group">
            <button className="app-btn app-btn--secondary app-btn--sm mb-4" onClick={() => { setIsEditing(false); setIsCreating(false); }}>
              <ArrowLeft size={16} className="mr-2" /> Back to List
            </button>
            <h2 className="app-module__title">{isCreating ? 'Create New Unit' : `Edit ${selectedUnit?.UnitName}`}</h2>
          </div>
          <div className="app-module__actions">
            <button className="app-btn app-btn--primary" onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
              Save Changes
            </button>
          </div>
        </header>

        {error && <div className="app-alert app-alert--error mb-6">{error}</div>}

        <div className="app-card">
          <div className="app-form-grid p-6">
            <div className="app-form-group">
              <label className="app-form-label">Unit Name</label>
              <input 
                className="app-form__input" 
                value={unitName} 
                onChange={e => setUnitName(e.target.value)} 
                placeholder="e.g. ICT Directorate"
              />
            </div>
            <div className="app-form-group">
              <label className="app-form-label">Unit Code</label>
              <input 
                className="app-form__input" 
                value={unitCode} 
                onChange={e => setUnitCode(e.target.value.toUpperCase().replace(/\s/g, '_'))} 
                placeholder="e.g. ICT_DIR"
              />
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
              <input 
                type="number"
                className="app-form__input" 
                value={sortOrder} 
                onChange={e => setSortOrder(parseInt(e.target.value))} 
              />
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
      </section>
    );
  }

  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
        </div>
        <div className="app-module__actions">
          <button className="app-btn app-btn--primary" onClick={() => handleCreateNew()}>
            <Plus size={18} className="mr-2" /> Add New Unit
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
            <thead>
              <tr>
                <th>Unit Name</th>
                <th>Code</th>
                <th>Type</th>
                <th>Assignable</th>
                <th className="app-table__cell--numeric">Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && units.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Loader2 className="animate-spin mx-auto mb-2 text-emerald-600" />
                    <p className="text-slate-500">Loading units...</p>
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
                      <button className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleEdit(unit)}>
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                unitTree.get(null)?.map(rootUnit => renderUnitRow(rootUnit))
              )}
              {filteredUnits.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No organizational units found.
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
