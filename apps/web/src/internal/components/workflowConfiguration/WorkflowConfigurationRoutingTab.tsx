import type { Dispatch, SetStateAction } from 'react';
import type { WorkflowConfigurationStage, WorkflowConfigurationTransition } from '../../types/internal';
import type { TransitionFormState } from './shared';

type Props = {
  transitions: WorkflowConfigurationTransition[];
  stageLookup: Map<string, WorkflowConfigurationStage>;
  stages: WorkflowConfigurationStage[];
  transitionForm: TransitionFormState;
  setTransitionForm: Dispatch<SetStateAction<TransitionFormState>>;
  isSaving: boolean;
  onCreate: () => Promise<void>;
  onDelete: (transitionId: string) => Promise<void>;
};

export const WorkflowConfigurationRoutingTab = ({
  transitions,
  stageLookup,
  stages,
  transitionForm,
  setTransitionForm,
  isSaving,
  onCreate,
  onDelete
}: Props) => (
  <div className="admin-grid">
    <article className="admin-card admin-card--wide">
      <h3>Routing Rules</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="plan-table">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Condition</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {transitions.map((transition) => (
              <tr key={transition.TransitionId}>
                <td>{stageLookup.get(transition.FromStageKey)?.StageTitle ?? transition.FromStageKey}</td>
                <td>{stageLookup.get(transition.ToStageKey)?.StageTitle ?? transition.ToStageKey}</td>
                <td>{transition.TransitionCondition}</td>
                <td>
                  <button
                    type="button"
                    className="plan-link plan-link--danger"
                    onClick={() => void onDelete(transition.TransitionId)}
                    disabled={isSaving}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
    <article className="admin-card admin-card--mid">
      <h3>Add Transition</h3>
      <div className="plan-form-grid">
        <label className="plan-field">
          <span>From Stage</span>
          <select
            className="plan-select"
            value={transitionForm.fromStageKey}
            onChange={(event) => setTransitionForm((prev) => ({ ...prev, fromStageKey: event.target.value }))}
          >
            <option value="">Select stage</option>
            {stages.map((stage) => (
              <option key={stage.StageKey} value={stage.StageKey}>
                {stage.StageTitle}
              </option>
            ))}
          </select>
        </label>
        <label className="plan-field">
          <span>To Stage</span>
          <select
            className="plan-select"
            value={transitionForm.toStageKey}
            onChange={(event) => setTransitionForm((prev) => ({ ...prev, toStageKey: event.target.value }))}
          >
            <option value="">Select stage</option>
            {stages.map((stage) => (
              <option key={stage.StageKey} value={stage.StageKey}>
                {stage.StageTitle}
              </option>
            ))}
          </select>
        </label>
        <label className="plan-field plan-field--span">
          <span>Condition</span>
          <textarea
            className="plan-textarea"
            rows={4}
            value={transitionForm.transitionCondition}
            onChange={(event) => setTransitionForm((prev) => ({ ...prev, transitionCondition: event.target.value }))}
          />
        </label>
      </div>
      <div className="plan-actions">
        <button type="button" className="plan-button" onClick={() => void onCreate()} disabled={isSaving}>
          Add Transition
        </button>
      </div>
    </article>
  </div>
);
