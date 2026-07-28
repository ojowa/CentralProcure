import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { InternalModule } from '../types/internal';
import { getInternalDashboardPath } from '../utils/internalRoutes';

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
    let sectionName = module.section;
    if (sectionName === 'Governance & Approval' || sectionName === 'Procurement Planning') {
      sectionName = 'Governance and Planning';
    }
    accumulator[sectionName] = accumulator[sectionName] ?? [];
    accumulator[sectionName].push(module);
    return accumulator;
  }, {});

  const sortedSections = useMemo(() => {
    const entries = Object.entries(grouped);
    return entries.sort(([a], [b]) => {
      const getWeight = (name: string) => {
        if (name === 'Governance and Planning') return 1000;
        if (name === 'Account Management') return 900;
        return 0;
      };
      const weightA = getWeight(a);
      const weightB = getWeight(b);
      
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.localeCompare(b);
    });
  }, [grouped]);

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
        <Link
          href={getInternalDashboardPath()}
          className={activeModuleId === 'dashboard' ? 'active' : ''}
          onClick={() => onModuleChange('dashboard')}
        >
          Dashboard
        </Link>
      </section>
      {sortedSections.map(([section, sectionModules]) => (
        <section key={section} className="portal-sidebar-section">
          <h3>{section}</h3>
          {sectionModules.map((module) => (
            <Link
              href={getInternalDashboardPath(module.id)}
              key={module.id}
              className={module.id === activeModuleId ? 'active' : ''}
              onClick={() => onModuleChange(module.id)}
            >
              {module.title}
            </Link>
          ))}
        </section>
      ))}
      {!sortedSections.length ? <div className="plan-empty">No modules match the current search.</div> : null}
    </aside>
  );
};

