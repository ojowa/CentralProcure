'use client';

import React from 'react';

export const AuditComplianceHealth = () => {
  return (
    <div className="compliance-health-grid">
      <article className="portal-module-card">
        <h3>PPA Compliance Index</h3>
        <div className="health-stat">
          <div className="health-circle good">98%</div>
          <p>Total statutory alignment across all active projects.</p>
        </div>
      </article>

      <article className="portal-module-card">
        <h3>Timeline Integrity</h3>
        <div className="health-stat">
          <div className="health-circle warn">84%</div>
          <p>Projects meeting PPA-mandated advertising durations.</p>
        </div>
      </article>

      <article className="portal-module-card">
        <h3>Threshold Routing Accuracy</h3>
        <div className="health-stat">
          <div className="health-circle good">100%</div>
          <p>Zero exceptions found in automated threshold routing.</p>
        </div>
      </article>

      <style jsx>{`
        .compliance-health-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 24px;
        }
        .health-stat {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-top: 16px;
        }
        .health-circle {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 1.125rem;
          flex-shrink: 0;
        }
        .health-circle.good {
          background: rgba(11, 93, 59, 0.1);
          color: var(--portal-forest);
          border: 2px solid var(--portal-forest);
        }
        .health-circle.warn {
          background: rgba(194, 138, 44, 0.1);
          color: var(--portal-gold);
          border: 2px solid var(--portal-gold);
        }
        .health-stat p {
          font-size: 0.875rem;
          color: var(--portal-slate);
          margin: 0;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
};
