import React, { useMemo, useState } from 'react';
import type { InternalModule } from '../types/internal';

interface SidebarProps {
  modules: InternalModule[];
  activeModuleId: string;
  onModuleChange: (moduleId: string) => void;
}

export const SidebarNav = ({ modules, activeModuleId, onModuleChange }: SidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return modules;
    }

    return modules.filter((module) => {
      return [module.title, module.section, module.description, module.controlPurpose]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [modules, searchQuery]);

  const grouped = filteredModules.reduce<Record<string, InternalModule[]>>((accumulator, module) => {
    accumulator[module.section] = accumulator[module.section] ?? [];
    accumulator[module.section].push(module);
    return accumulator;
  }, {});

  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar__title">Workflow Modules</div>
      <label className="plan-field">
        <span>Search Modules</span>
        <input
          className="plan-input"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search sidebar links"
        />
      </label>
      <section className="portal-sidebar-section">
        <h3>Workspace</h3>
        <button
          type="button"
          className={activeModuleId === 'dashboard' ? 'active' : ''}
          onClick={() => onModuleChange('dashboard')}
        >
          Dashboard
        </button>
      </section>
      {Object.entries(grouped).map(([section, sectionModules]) => (
        <section key={section} className="portal-sidebar-section">
          <h3>{section}</h3>
          {sectionModules.map((module) => (
            <button
              type="button"
              key={module.id}
              className={module.id === activeModuleId ? 'active' : ''}
              onClick={() => onModuleChange(module.id)}
            >
              {module.title}
            </button>
          ))}
        </section>
      ))}
      {!Object.keys(grouped).length ? <div className="plan-empty">No modules match the current search.</div> : null}
    </aside>
  );
};

