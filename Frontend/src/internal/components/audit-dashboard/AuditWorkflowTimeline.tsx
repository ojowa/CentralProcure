'use client';

import React from 'react';
import type { AuditEventItem } from '../../types/internal';

const formatDateTimeShort = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const toTitle = (value?: string | null) =>
  value ? value.replace(/_/g, ' ').split(' ').map(p => p ? p[0].toUpperCase() + p.slice(1) : p).join(' ') : 'Unspecified';

type Props = {
  events: AuditEventItem[];
};

export const AuditWorkflowTimeline = ({ events }: Props) => {
  return (
    <article className="portal-module-card animate-fade">
      <div className="view-header">
        <h3>Workflow Audit Timeline</h3>
        <p>Real-time stream of all system-wide state transitions and authority actions.</p>
      </div>

      <div className="plan-table-wrapper">
        <table className="plan-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Authority Action</th>
              <th>Transition To</th>
              <th>Actor</th>
              <th>Impacted Entity</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.HistoryId}>
                <td>{formatDateTimeShort(event.CreatedAt)}</td>
                <td>
                  <span className="admin-status admin-status--soft">{event.TransitionSource || 'Workflow Engine'}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{event.ToStageTitle}</div>
                  <div className="plan-muted" style={{ fontSize: '0.7rem' }}>Status: {event.StageStatus || 'Confirmed'}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{event.Actor || 'System'}</div>
                </td>
                <td>
                  <code className="plan-code" style={{ fontSize: '0.7rem' }}>
                    {toTitle(event.EntityType)} · {event.EntityId.split('-')[0].toUpperCase()}
                  </code>
                </td>
              </tr>
            ))}
            {!events.length && (
              <tr>
                <td colSpan={5} className="plan-empty">No recent workflow events recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
};
