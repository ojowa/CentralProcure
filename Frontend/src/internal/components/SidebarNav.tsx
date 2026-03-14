import React from 'react';
import type { InternalModule } from '../types/internal';

interface SidebarProps {
  modules: InternalModule[];
  activeModuleId: string;
  onModuleChange: (moduleId: string) => void;
}

export const SidebarNav = ({ modules, activeModuleId, onModuleChange }: SidebarProps) => {
  const grouped = modules.reduce<Record<string, InternalModule[]>>((accumulator, module) => {
    accumulator[module.section] = accumulator[module.section] ?? [];
    accumulator[module.section].push(module);
    return accumulator;
  }, {});

  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar__title">Workflow Modules</div>
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
    </aside>
  );
};

