'use client';

import React, { useState } from 'react';
import type { InternalModule, RoleKey } from '../types/internal';
import { NeedsCollectionModule } from './NeedsCollectionModule';
import { AdminRequisitionManagementPage } from './AdminRequisitionManagementPage';
import { ClipboardList, FileText } from 'lucide-react';

interface NeedsAndRequisitionsModuleProps {
  module: InternalModule;
  token: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds?: string[];
  onModuleChange?: (moduleId: string) => void;
}

type TopTab = 'needs' | 'requisitions';

export const NeedsAndRequisitionsModule: React.FC<NeedsAndRequisitionsModuleProps> = ({
  module,
  token,
  role,
  userEmail,
  availableModuleIds = [],
  onModuleChange,
}) => {
  const [activeTab, setActiveTab] = useState<TopTab>('needs');

  const tabs: { key: TopTab; label: string; icon: React.ReactNode }[] = [
    { key: 'needs', label: 'Needs Collection & Analysis', icon: <ClipboardList size={15} /> },
    { key: 'requisitions', label: 'Requisitions', icon: <FileText size={15} /> },
  ];

  return (
    <section className="portal-module">
      <header className="portal-module__header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
      </header>

      <div className="plan-toolbar" style={{ marginBottom: '16px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`plan-pill ${activeTab === tab.key ? 'plan-pill--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'needs' && token && (
        <NeedsCollectionModule module={module} token={token} role={role} />
      )}

      {activeTab === 'requisitions' && (
        <AdminRequisitionManagementPage
          module={module}
          token={token}
          role={role}
          userEmail={userEmail}
          availableModuleIds={availableModuleIds}
          onModuleChange={onModuleChange}
        />
      )}
    </section>
  );
};
