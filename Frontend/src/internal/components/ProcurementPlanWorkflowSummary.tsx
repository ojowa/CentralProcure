import type { ProcurementPlanDetail } from '../types/internal';

type Props = {
  selectedPlan: ProcurementPlanDetail;
};

const stageConfig: Record<string, { label: string; owner: string; nextAction: string; icon: string }> = {
  planning_committee_review: {
    label: 'Planning Committee Review',
    owner: 'Procurement Secretary and planning committee members',
    nextAction: 'Secretary reviews APP readiness and recommends the APP for approval.',
    icon: '📋'
  },
  app_approval: {
    label: 'APP Approval',
    owner: 'Comptroller Procurement / Accounting Officer',
    nextAction: 'Approval authority records approve, return, or reject decision.',
    icon: '✓'
  },
  accounting_officer_review: {
    label: 'CGIS Approval',
    owner: 'CGIS',
    nextAction: 'CGIS reviews the approved departmental plan before procurement process begins.',
    icon: '🛡'
  },
  procurement_initiation: {
    label: 'Procurement Initiation',
    owner: 'Comptroller Procurement',
    nextAction: 'Resolve threshold route and move the APP into live procurement execution.',
    icon: '🚀'
  }
};

const orderedStages = ['planning_committee_review', 'app_approval', 'accounting_officer_review', 'procurement_initiation'];

export const ProcurementPlanWorkflowSummary = ({ selectedPlan }: Props) => {
  const currentStageKey = selectedPlan.CurrentStageKey || 'unknown';
  const currentIndex = orderedStages.indexOf(currentStageKey);
  const currentConfig = stageConfig[currentStageKey];

  const getStageStatus = (index: number): { state: string; variant: string } => {
    if (index < currentIndex) return { state: 'Completed', variant: 'completed' };
    if (index === currentIndex) return { state: 'Active', variant: 'active' };
    return { state: 'Pending', variant: 'pending' };
  };

  return (
    <section className="app-card">
      <div className="app-card__header">
        <div className="app-section-title">
          <span className="app-section-title__icon">🔄</span>
          <h3 className="app-section-title__text">Workflow Alignment</h3>
        </div>
      </div>

      {/* Current Stage Summary */}
      <div className="app-workflow-summary">
        <div className="app-workflow-summary__item">
          <span className="app-workflow-summary__label">Current Stage</span>
          <div className="app-workflow-summary__value">
            <span className="app-stage-badge app-stage-badge--active">
              {selectedPlan.CurrentStageTitle || currentConfig?.label || currentStageKey}
            </span>
          </div>
        </div>
        <div className="app-workflow-summary__item">
          <span className="app-workflow-summary__label">Current Owner</span>
          <div className="app-workflow-summary__value">
            {currentConfig?.owner || 'Not mapped'}
          </div>
        </div>
        <div className="app-workflow-summary__item app-workflow-summary__item--full">
          <span className="app-workflow-summary__label">Next Action</span>
          <div className="app-workflow-summary__value app-workflow-summary__value--highlight">
            {currentConfig?.nextAction || 'No workflow guidance available.'}
          </div>
        </div>
        <div className="app-workflow-summary__item">
          <span className="app-workflow-summary__label">Plan Status</span>
          <div className="app-workflow-summary__value">
            <span className={`app-badge app-badge--${selectedPlan.Status.toLowerCase()}`}>
              {selectedPlan.Status}
            </span>
          </div>
        </div>
      </div>

      {/* Stage Timeline */}
      <div className="app-workflow-timeline">
        {orderedStages.map((stageKey, index) => {
          const stage = stageConfig[stageKey];
          const { state, variant } = getStageStatus(index);

          return (
            <div key={stageKey} className={`app-workflow-step app-workflow-step--${variant}`}>
              <div className="app-workflow-step__indicator">
                <span className="app-workflow-step__icon">{stage.icon}</span>
                {index < orderedStages.length - 1 && (
                  <div className="app-workflow-step__connector" />
                )}
              </div>
              <div className="app-workflow-step__content">
                <div className="app-workflow-step__header">
                  <span className={`app-workflow-step__badge app-workflow-step__badge--${variant}`}>
                    {state}
                  </span>
                </div>
                <h4 className="app-workflow-step__title">{stage.label}</h4>
                <p className="app-workflow-step__owner">{stage.owner}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
