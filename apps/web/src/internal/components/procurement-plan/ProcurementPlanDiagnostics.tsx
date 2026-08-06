import type { ProcurementPlanDetail } from '../../types/internal';
import type { YearlyAppDetail } from '../../services/procurementPlanService';

type Props = {
  role?: string | null;
  selectedYearlyApp: YearlyAppDetail | null;
  selectedPlan: ProcurementPlanDetail | null;
  canRecommendApp: boolean;
};

export const ProcurementPlanDiagnostics = ({
  role,
  selectedYearlyApp,
  selectedPlan,
  canRecommendApp
}: Props) => (
  <section className="app-card app-card--compact">
    <div className="app-card__header">
      <div className="app-section-title">
        <span className="app-section-title__icon">🔧</span>
        <h3 className="app-section-title__text">APP Diagnostics</h3>
      </div>
    </div>
    <div className="app-diagnostics-grid">
      <div className="app-diagnostic-item">
        <span className="app-diagnostic-item__label">Role</span>
        <span className="app-diagnostic-item__value">{role || 'unresolved'}</span>
      </div>
      <div className="app-diagnostic-item">
        <span className="app-diagnostic-item__label">Plan Stage</span>
        <span className="app-diagnostic-item__value">
          {selectedPlan?.CurrentStageKey || 'no plan selected'}
        </span>
      </div>
      <div className="app-diagnostic-item">
        <span className="app-diagnostic-item__label">Secretary Panel</span>
        <span className={`app-diagnostic-item__value app-diagnostic-item__value--${canRecommendApp ? 'success' : 'muted'}`}>
          {canRecommendApp ? 'visible' : 'hidden'}
        </span>
      </div>
    </div>
  </section>
);
