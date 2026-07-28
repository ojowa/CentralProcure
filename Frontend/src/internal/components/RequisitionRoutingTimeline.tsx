'use client';

import type { WorkflowRuntimeHistoryEntry } from '../types/internal';
import { formatDateTimeShort } from '../utils/procureUtils';

interface RequisitionRoutingTimelineProps {
  history: WorkflowRuntimeHistoryEntry[];
  currentStage?: string | null;
  isLoading?: boolean;
}

const actionIcons: Record<string, string> = {
  create: '📝',
  submit: '📤',
  endorse: '✓',
  return: '↩',
  reject: '✕',
  approve: '✓',
  review: '👁',
  evaluate: '📊',
  escalate: '⬆',
  default: '●'
};

const getActionIcon = (action: string) => {
  const key = Object.keys(actionIcons).find(k => action.toLowerCase().includes(k));
  return actionIcons[key || 'default'];
};

const getActionTone = (action: string): string => {
  const lower = action.toLowerCase();
  if (lower.includes('approve') || lower.includes('endorse')) return 'success';
  if (lower.includes('reject')) return 'danger';
  if (lower.includes('return')) return 'warning';
  if (lower.includes('submit') || lower.includes('create')) return 'info';
  return 'neutral';
};

export const RequisitionRoutingTimeline = ({
  history,
  currentStage,
  isLoading
}: RequisitionRoutingTimelineProps) => {
  if (isLoading) {
    return (
      <div className="routing-timeline routing-timeline--loading">
        <div className="routing-timeline__spinner">⏳</div>
        <span>Loading routing history...</span>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="routing-timeline routing-timeline--empty">
        <span className="routing-timeline__icon">📭</span>
        <p>No routing history available yet.</p>
        <span className="routing-timeline__hint">History will appear as the requisition moves through workflow stages.</span>
      </div>
    );
  }

  // Group entries by stage
  const grouped = history.reduce((acc, entry) => {
    const stage = entry.ToStageTitle || entry.ToStageKey || 'Unknown';
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(entry);
    return acc;
  }, {} as Record<string, WorkflowRuntimeHistoryEntry[]>);

  const stages = Object.keys(grouped);
  const currentStageIndex = currentStage ? stages.findIndex(s => s.toLowerCase() === currentStage.toLowerCase()) : -1;

  return (
    <div className="routing-timeline">
      <div className="routing-timeline__header">
        <h4 className="routing-timeline__title">Routing Timeline</h4>
        <span className="routing-timeline__count">{history.length} events</span>
      </div>

      <div className="routing-timeline__stages">
        {stages.map((stage, stageIndex) => {
          const entries = grouped[stage];
          const isCurrentStage = stageIndex === currentStageIndex || stage.toLowerCase() === currentStage?.toLowerCase();
          const isPastStage = currentStageIndex > -1 && stageIndex < currentStageIndex;
          const isFutureStage = currentStageIndex > -1 && stageIndex > currentStageIndex;

          return (
            <div
              key={stage}
              className={`routing-stage ${isCurrentStage ? 'routing-stage--current' : ''} ${isPastStage ? 'routing-stage--past' : ''} ${isFutureStage ? 'routing-stage--future' : ''}`}
            >
              <div className="routing-stage__header">
                <div className="routing-stage__connector">
                  <span className="routing-stage__dot" />
                  {stageIndex < stages.length - 1 && <span className="routing-stage__line" />}
                </div>
                <div className="routing-stage__info">
                  <h5 className="routing-stage__title">{stage}</h5>
                  {isCurrentStage && <span className="routing-stage__badge routing-stage__badge--current">Current</span>}
                  {isFutureStage && <span className="routing-stage__badge routing-stage__badge--pending">Pending</span>}
                </div>
                <span className="routing-stage__count">{entries.length} action{entries.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="routing-stage__events">
                {entries.map((entry, index) => (
                  <div key={entry.HistoryId || index} className={`routing-event routing-event--${getActionTone(entry.TransitionSource)}`}>
                    <span className="routing-event__icon">{getActionIcon(entry.TransitionSource)}</span>
                    <div className="routing-event__content">
                      <div className="routing-event__header">
                        <span className="routing-event__action">{entry.TransitionSource}</span>
                        <span className="routing-event__time">{formatDateTimeShort(entry.CreatedAt)}</span>
                      </div>
                      {entry.Actor && (
                        <span className="routing-event__actor">by {entry.Actor}</span>
                      )}
                      {entry.TransitionReason && (
                        <p className="routing-event__notes">{entry.TransitionReason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RequisitionRoutingTimeline;
