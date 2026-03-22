import React from 'react';
import Link from 'next/link';
import type { InternalModule } from '../types/internal';
import { getInternalDashboardPath } from '../utils/internalRoutes';

interface DashboardProps {
  modules: InternalModule[];
}

export const DashboardPage = ({ modules }: DashboardProps) => {
  const moduleCount = modules.length;
  const sectionCount = new Set(modules.map((module) => module.section)).size;
  const controlCount = new Set(modules.map((module) => module.controlPurpose)).size;
  return (
    <section className="portal-dashboard">
      <h2>Role Dashboard</h2>
      <p>Your access is scoped to modules approved for your role. Every module below has a direct route link.</p>
      <div className="portal-stats">
        <article className="portal-stat">
          <strong>{moduleCount}</strong>
          <span>Accessible Modules</span>
        </article>
        <article className="portal-stat">
          <strong>{sectionCount}</strong>
          <span>Workflow Sections</span>
        </article>
        <article className="portal-stat">
          <strong>{controlCount}</strong>
          <span>Governance Controls</span>
        </article>
      </div>
      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        {modules.map((module) => (
          <article key={module.id} className="portal-module-card">
            <h3>
              <Link className="plan-link" href={getInternalDashboardPath(module.id)}>
                {module.title}
              </Link>
            </h3>
            <p>{module.microservice}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

