import React from 'react';
import type { RoleDefinition } from '../types/internal';
import { toTitle, formatDateTimeShort } from '../utils/procureUtils';

interface HeaderProps {
  role: RoleDefinition;
  onSignOut: () => void;
}

export const InternalHeader = ({ role, onSignOut }: HeaderProps) => {
  const today = new Date().toLocaleDateString('en-NG', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <header className="portal-topbar">
      <div className="portal-brand">
        <div className="portal-emblem">NIS</div>
        <div>
          <div className="portal-title">NIS e-Procurement</div>
          <div className="portal-subtitle">Internal Control Center</div>
        </div>
      </div>
      <div className="portal-meta">
        <span className="portal-chip">
          Role: <strong>{role.name}</strong>
        </span>
        <span className="portal-chip">
          Today: <strong>{today}</strong>
        </span>
        <button type="button" className="portal-signout" onClick={onSignOut}>
          Sign Out
        </button>
      </div>
    </header>
  );
};

