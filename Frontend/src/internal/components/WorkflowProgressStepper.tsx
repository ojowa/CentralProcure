'use client';

import React from 'react';

export type WorkflowPhase = 'Planning' | 'Solicitation' | 'Evaluation' | 'Approval' | 'Post-Award';

interface PhaseConfig {
  label: WorkflowPhase;
  states: string[];
  color: string;
}

const PHASES: PhaseConfig[] = [
  {
    label: 'Planning',
    states: ['draft_requisition', 'needs_assessment', 'budget_reservation'],
    color: '#3b82f6' // Blue
  },
  {
    label: 'Solicitation',
    states: ['tender_preparation', 'advertisement', 'bid_submission'],
    color: '#f59e0b' // Orange
  },
  {
    label: 'Evaluation',
    states: ['bid_opening', 'technical_evaluation', 'financial_comparison'],
    color: '#a855f7' // Purple
  },
  {
    label: 'Approval',
    states: ['tenders_board_review', 'accounting_officer_approval', 'bpp_no_objection'],
    color: '#eab308' // Yellow
  },
  {
    label: 'Post-Award',
    states: ['contract_execution', 'inspection_and_payment', 'closeout_and_audit', 'archived'],
    color: '#10b981' // NIS Green
  }
];

interface Props {
  currentStageKey: string;
}

export const WorkflowProgressStepper: React.FC<Props> = ({ currentStageKey }) => {
  const normalizedKey = (currentStageKey || '').toLowerCase();
  
  // Determine current phase index
  const currentPhaseIndex = PHASES.findIndex(phase => 
    phase.states.includes(normalizedKey)
  );

  return (
    <div className="workflow-stepper">
      {PHASES.map((phase, index) => {
        const isCompleted = index < currentPhaseIndex;
        const isActive = index === currentPhaseIndex;
        const statusClass = isCompleted ? 'completed' : isActive ? 'active' : 'pending';

        return (
          <div 
            key={phase.label} 
            className={`stepper-item ${statusClass}`}
            style={{ '--phase-color': phase.color } as React.CSSProperties}
          >
            <div className="stepper-chevron">
              <span className="phase-icon">
                {isCompleted ? '✅' : index + 1}
              </span>
              <span className="phase-label">{phase.label}</span>
            </div>
            {index < PHASES.length - 1 && <div className="stepper-connector" />}
          </div>
        );
      })}

      <style jsx>{`
        .workflow-stepper {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 1rem 0;
          overflow-x: auto;
          font-family: inherit;
        }

        .stepper-item {
          display: flex;
          align-items: center;
          flex: 1;
          position: relative;
          min-width: 120px;
        }

        .stepper-chevron {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          z-index: 2;
          background: white;
          padding: 0 0.5rem;
        }

        .phase-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.875rem;
          border: 2px solid #e5e7eb;
          background: #f9fafb;
          color: #6b7280;
          transition: all 0.3s ease;
        }

        .phase-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .stepper-connector {
          flex: 1;
          height: 2px;
          background: #e5e7eb;
          margin: 0 -16px;
          margin-top: -24px; /* Align with icon center */
        }

        /* Active State */
        .stepper-item.active .phase-icon {
          border-color: var(--phase-color);
          background: var(--phase-color);
          color: white;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
        }

        .stepper-item.active .phase-label {
          color: var(--phase-color);
        }

        /* Completed State */
        .stepper-item.completed .phase-icon {
          border-color: var(--phase-color);
          color: var(--phase-color);
          background: white;
        }

        .stepper-item.completed .phase-label {
          color: #374151;
        }

        .stepper-item.completed .stepper-connector {
          background: var(--phase-color);
        }

        /* Responsive */
        @media (max-width: 640px) {
          .phase-label {
            display: none;
          }
          .stepper-item {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
};
