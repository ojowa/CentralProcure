'use client';

import React from 'react';
import type { WorkflowRuntimeDisplay } from './workflowDisplayTypes';

export type WorkflowPhase = 'Planning' | 'Advert / Invitation / EOI / RFP' | 'Evaluation' | 'Approval' | 'Post-Award';

interface PhaseConfig {
  id: WorkflowPhase;
  label: string;
  states: string[];
  color: string;
}

const PHASES: PhaseConfig[] = [
  {
    id: 'Planning',
    label: 'Planning',
    states: [
      'needs_collection',
      'needs_analysis',
      'needs_assessment',
      'budget_allocation_and_confirmation',
      'planning_committee_review',
      'app_approval',
      'procurement_initiation',
      'threshold_resolution',
      'method_validation'
    ],
    color: '#3b82f6' // Blue
  },
  {
    id: 'Advert / Invitation / EOI / RFP',
    label: 'Advert / Invitation / EOI / RFP',
    states: ['solicitation'],
    color: '#f59e0b' // Orange
  },
  {
    id: 'Evaluation',
    label: 'Evaluation',
    states: ['bid_opening', 'evaluation'],
    color: '#a855f7' // Purple
  },
  {
    id: 'Approval',
    label: 'Approval',
    states: ['tenders_board_review', 'accounting_officer_review', 'bpp_no_objection'],
    color: '#eab308' // Yellow
  },
  {
    id: 'Post-Award',
    label: 'Post-Award',
    states: ['award_and_publication', 'contract_execution', 'inspection_and_payment', 'closeout_and_audit'],
    color: '#10b981' // NIS Green
  }
];

interface Props {
  currentStageKey: string;
  display?: WorkflowRuntimeDisplay | null;
}

export const WorkflowProgressStepper: React.FC<Props> = ({ currentStageKey, display }) => {
  const normalizedKey = (currentStageKey || '').toLowerCase();
  const currentPhaseIndex = PHASES.findIndex((phase) => phase.states.includes(normalizedKey));
  const displayPhases = display?.Phases?.length
    ? display.Phases.map((phase) => ({
        id: phase.PhaseKey,
        label: phase.PhaseLabel,
        color: phase.Color,
        status: phase.Status
      }))
    : null;
  const phases = displayPhases ?? PHASES.map((phase, index) => ({
    id: phase.id,
    label: phase.label,
    color: phase.color,
    status: index < currentPhaseIndex ? 'completed' : index === currentPhaseIndex ? 'active' : 'pending'
  }));

  return (
    <div className="workflow-stepper">
      {phases.map((phase, index) => {
        const isCompleted = phase.status === 'completed';
        const isActive = phase.status === 'active';
        const statusClass = isCompleted ? 'completed' : isActive ? 'active' : 'pending';

        return (
          <div 
            key={phase.id} 
            className={`stepper-item ${statusClass}`}
            style={{ '--phase-color': phase.color } as React.CSSProperties}
          >
            <div className="stepper-chevron">
              <span className="phase-icon">
                {isCompleted ? '✅' : index + 1}
              </span>
              <span className="phase-label">{phase.label}</span>
            </div>
            {index < phases.length - 1 && <div className="stepper-connector" />}
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
