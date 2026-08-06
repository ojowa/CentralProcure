'use client';

import React, { useEffect, useState } from 'react';
import { fetchInternalUnitStaff } from '../../services/internalAuthService';
import type { InternalUnitStaffRecord, InternalOrganizationalUnitRecord } from '../../types/internal';
import { Loader2, User, Mail, Shield, CheckCircle2, XCircle } from 'lucide-react';

interface UnitStaffModalProps {
  unit: InternalOrganizationalUnitRecord | null;
  isOpen: boolean;
  token: string;
  onClose: () => void;
}

export const UnitStaffModal: React.FC<UnitStaffModalProps> = ({ unit, isOpen, token, onClose }) => {
  const [staff, setStaff] = useState<InternalUnitStaffRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && unit) {
      const loadStaff = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await fetchInternalUnitStaff(token, unit.UnitId);
          setStaff(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      void loadStaff();
    }
  }, [isOpen, unit, token]);

  if (!isOpen) return null;

  return (
    <div className="portal-modal-overlay">
      <div className="portal-modal-container" style={{ maxWidth: '800px', width: '95%' }}>
        <header className="portal-modal-header">
          <div>
            <h3>Unit Staff List</h3>
            <p className="text-sm text-slate-500">{unit?.UnitName} ({unit?.UnitCode})</p>
          </div>
          <button type="button" className="portal-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </header>

        <div className="portal-modal-body p-0">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin mx-auto mb-2 text-emerald-600" />
              <p className="text-slate-500">Fetching staff list...</p>
            </div>
          ) : error ? (
            <div className="p-8">
              <div className="app-alert app-alert--error">{error}</div>
            </div>
          ) : staff.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <User size={48} className="mx-auto mb-4 opacity-20" />
              <p>No staff members assigned to this unit.</p>
            </div>
          ) : (
            <div className="app-table-wrapper border-0 rounded-none overflow-visible">
              <table className="app-table">
                <thead className="bg-slate-50">
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.InternalUserId}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                            {member.FirstName[0]}{member.Surname[0]}
                          </div>
                          <div className="font-medium text-slate-800">
                            {member.FirstName} {member.Surname}
                            <div className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">{member.Username}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Mail size={14} className="text-slate-400" />
                          <span className="text-sm">{member.Email}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Shield size={14} className="text-emerald-500" />
                          <span className="text-sm">{member.RoleName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {member.Status === 'Active' ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <XCircle size={14} className="text-rose-500" />
                          )}
                          <span className={`text-xs font-medium ${member.Status === 'Active' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {member.Status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="portal-modal-footer">
          <div className="text-xs text-slate-400 mr-auto">
            Total Staff: {staff.length}
          </div>
          <button type="button" className="app-btn app-btn--secondary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};
