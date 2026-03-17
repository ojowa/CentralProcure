'use client';

import React from 'react';

export type AuditViewType = 'overview' | 'closeouts' | 'timeline';

type Props = {
  activeView: AuditViewType;
  onViewChange: (view: AuditViewType) => void;
};

export const AuditSubNav = ({ activeView, onViewChange }: Props) => {
  return (
    <nav className="plan-tabs" style={{ marginBottom: '24px' }}>
      <button
        type="button"
        className={activeView === 'overview' ? 'plan-tab plan-tab--active' : 'plan-tab'}
        onClick={() => onViewChange('overview')}
      >
        Oversight Overview
      </button>
      <button
        type="button"
        className={activeView === 'closeouts' ? 'plan-tab plan-tab--active' : 'plan-tab'}
        onClick={() => onViewChange('closeouts')}
      >
        Closeout Register
      </button>
      <button
        type="button"
        className={activeView === 'timeline' ? 'plan-tab plan-tab--active' : 'plan-tab'}
        onClick={() => onViewChange('timeline')}
      >
        Workflow Audit Timeline
      </button>
    </nav>
  );
};
