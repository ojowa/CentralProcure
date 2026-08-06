import React from 'react';
import type { RoleDefinition } from '../../types/internal';
import { toTitle, formatDateTimeShort } from '../../utils/procureUtils';
import { NotificationBell } from '../shared/NotificationBell';

interface HeaderProps {
  role: RoleDefinition;
  token: string | null;
  onSignOut: () => void;
}

export const InternalHeader = ({ role, token, onSignOut }: HeaderProps) => {
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
        <NotificationBell token={token} />
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

