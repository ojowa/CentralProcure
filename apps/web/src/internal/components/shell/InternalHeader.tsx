import React from 'react';
import type { RoleDefinition } from '../../types/internal';
import { toTitle, formatDateTimeShort } from '../../utils/procureUtils';
import { NotificationBell } from '../shared/NotificationBell';

interface HeaderProps {
  role: RoleDefinition;
  token: string | null;
  onSignOut: () => void;
  onToggleSidebar?: () => void;
}

export const InternalHeader = ({ role, token, onSignOut, onToggleSidebar }: HeaderProps) => {
  const today = new Date().toLocaleDateString('en-NG', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <header className="portal-topbar">
      {onToggleSidebar && (
        <button
          type="button"
          className="portal-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}
      <div className="portal-brand">
        <img src="/nis-logo.png" alt="NIS Logo" className="portal-emblem" />
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

