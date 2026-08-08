import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { InternalModule, UserGroup } from '../../types/internal';
import { getInternalDashboardPath } from '../../utils/internalRoutes';

interface SidebarProps {
  modules: InternalModule[];
  activeModuleId: string;
  onModuleChange: (moduleId: string) => void;
}

interface GroupedNav {
  key: UserGroup | 'workspace' | 'account';
  label: string;
  sections: { label: string; modules: InternalModule[] }[];
}

const GROUP_ORDER: (UserGroup | 'workspace' | 'account')[] = [
  'workspace',
  'office_formation',
  'procurement_staff',
  'account',
];

const GROUP_LABELS: Record<string, string> = {
  workspace: 'Workspace',
  office_formation: 'Offices & Formations',
  procurement_staff: 'Procurement Operations',
  account: 'Account',
};

const SUB_SECTION_ORDER: Record<string, string[]> = {
  procurement_staff: [
    'Needs',
    'Planning & Budget',
    'Tendering & Sourcing',
    'Evaluation',
    'Governance & Approval',
    'Post-Award',
    'Oversight',
    'System Administration',
  ],
  office_formation: [
    'Needs',
  ],
};

const SUBSECTION_LABELS: Record<string, string> = {
  'Needs Collection': 'Needs',
};

const normalizeSubSectionLabel = (value: string): string => SUBSECTION_LABELS[value] ?? value;

export const SidebarNav = ({ modules, activeModuleId, onModuleChange }: SidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return modules;

    return modules.filter((m) =>
      [m.title, m.section, m.description, m.controlPurpose, m.subSection ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [modules, searchQuery]);

  const groupedNav = useMemo<GroupedNav[]>(() => {
    const navMap = new Map<string, GroupedNav>();

    for (const g of GROUP_ORDER) {
      navMap.set(g, { key: g, label: GROUP_LABELS[g], sections: [] });
    }

    const profileModule = filteredModules.find((m) => m.id === 'user-profile');
    const otherModules = filteredModules.filter((m) => m.id !== 'user-profile');

    for (const mod of otherModules) {
      const group = mod.group ?? 'procurement_staff';
      const nav = navMap.get(group) ?? navMap.get('procurement_staff')!;
      const subSection = normalizeSubSectionLabel(mod.subSection ?? mod.section ?? 'Other');

      let section = nav.sections.find((s) => s.label === subSection);
      if (!section) {
        section = { label: subSection, modules: [] };
        nav.sections.push(section);
      }
      section.modules.push(mod);
    }

    for (const nav of navMap.values()) {
      const order = SUB_SECTION_ORDER[nav.key] ?? [];
      nav.sections.sort((a, b) => {
        const idxA = order.indexOf(a.label);
        const idxB = order.indexOf(b.label);
        const wA = idxA >= 0 ? idxA : 999;
        const wB = idxB >= 0 ? idxB : 999;
        if (wA !== wB) return wA - wB;
        return a.label.localeCompare(b.label);
      });
    }

    if (profileModule) {
      const accountNav = navMap.get('account')!;
      accountNav.sections = [{ label: 'My Profile', modules: [profileModule] }];
    }

    return GROUP_ORDER.map((g) => navMap.get(g)!).filter(
      (nav) => nav.sections.length > 0 && nav.sections.some((s) => s.modules.length > 0)
    );
  }, [filteredModules]);

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

      {groupedNav
        .filter((nav) => nav.key !== 'workspace')
        .map((nav) => (
          <section key={nav.key} className="portal-sidebar-section">
            <h3>{nav.label}</h3>
            {nav.sections.map((section) => (
              <div key={section.label}>
                {section.label !== 'Other' && nav.sections.length > 1 && (
                  <div className="portal-sidebar-subsection">{section.label}</div>
                )}
                {section.modules.map((module) => (
                  <Link
                    href={getInternalDashboardPath(module.id)}
                    key={module.id}
                    className={module.id === activeModuleId ? 'active' : ''}
                    onClick={() => onModuleChange(module.id)}
                  >
                    {module.title}
                  </Link>
                ))}
              </div>
            ))}
          </section>
        ))}

      {!groupedNav.length && (
        <div className="plan-empty">No modules match the current search.</div>
      )}
    </aside>
  );
};
