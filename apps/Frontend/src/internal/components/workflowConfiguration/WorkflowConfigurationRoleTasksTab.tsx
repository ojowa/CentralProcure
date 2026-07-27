import type { Dispatch, SetStateAction } from 'react';
import type {
  WorkflowConfigurationRole,
  WorkflowConfigurationRoleTask,
  WorkflowConfigurationStage
} from '../../types/internal';
import type { RoleTaskFormState } from './shared';

type Props = {
  filteredRoleTasks: WorkflowConfigurationRoleTask[];
  stageLookup: Map<string, WorkflowConfigurationStage>;
  stages: WorkflowConfigurationStage[];
  selectedRoleFilter: string;
  setSelectedRoleFilter: Dispatch<SetStateAction<string>>;
  roles: WorkflowConfigurationRole[];
  roleTaskForm: RoleTaskFormState;
  setRoleTaskForm: Dispatch<SetStateAction<RoleTaskFormState>>;
  toTitle: (value: string) => string;
  isSaving: boolean;
  onCreate: () => Promise<void>;
  onDelete: (roleTaskId: string) => Promise<void>;
};

export const WorkflowConfigurationRoleTasksTab = ({
  filteredRoleTasks,
  stageLookup,
  stages,
  selectedRoleFilter,
  setSelectedRoleFilter,
  roles,
  roleTaskForm,
  setRoleTaskForm,
  toTitle,
  isSaving,
  onCreate,
  onDelete
}: Props) => (
  <div className="admin-grid">
    <article className="admin-card admin-card--wide">
      <h3>Role Responsibility Matrix</h3>
      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Role Filter</span>
            <select
              className="plan-select"
              value={selectedRoleFilter}
              onChange={(event) => {
                setSelectedRoleFilter(event.target.value);
                const matchedRole = roles.find((role) => role.RoleName === event.target.value);
                setRoleTaskForm((prev) => ({
                  ...prev,
                  roleKey: event.target.value,
                  displayName: matchedRole ? toTitle(matchedRole.RoleName) : prev.displayName
                }));
              }}
            >
              {roles.map((role) => (
                <option key={role.RoleName} value={role.RoleName}>
                  {role.RoleName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <table className="plan-table">
        <thead>
          <tr>
            <th>Stage</th>
            <th>Task</th>
            <th>Outcome</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filteredRoleTasks.map((task) => (
            <tr key={task.RoleTaskId}>
              <td>{stageLookup.get(task.StageKey)?.StageTitle ?? task.StageKey}</td>
              <td>{task.TaskDescription}</td>
              <td>{task.ExpectedOutcome}</td>
              <td>
                <button
                  type="button"
                  className="plan-link plan-link--danger"
                  onClick={() => void onDelete(task.RoleTaskId)}
                  disabled={isSaving}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {!filteredRoleTasks.length ? (
            <tr>
              <td colSpan={4} className="plan-empty">
                No role tasks found for the selected role.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </article>
    <article className="admin-card admin-card--mid">
      <h3>Add Role Task</h3>
      <div className="plan-form-grid">
        <label className="plan-field">
          <span>Role</span>
          <select
            className="plan-select"
            value={roleTaskForm.roleKey}
            onChange={(event) => {
              const matchedRole = roles.find((role) => role.RoleName === event.target.value);
              setRoleTaskForm((prev) => ({
                ...prev,
                roleKey: event.target.value,
                displayName: matchedRole ? toTitle(matchedRole.RoleName) : prev.displayName
              }));
            }}
          >
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role.RoleName} value={role.RoleName}>
                {role.RoleName}
              </option>
            ))}
          </select>
        </label>
        <label className="plan-field">
          <span>Display Name</span>
          <input
            className="plan-input"
            value={roleTaskForm.displayName}
            onChange={(event) => setRoleTaskForm((prev) => ({ ...prev, displayName: event.target.value }))}
          />
        </label>
        <label className="plan-field">
          <span>Stage</span>
          <select
            className="plan-select"
            value={roleTaskForm.stageKey}
            onChange={(event) => setRoleTaskForm((prev) => ({ ...prev, stageKey: event.target.value }))}
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
          <span>Task Description</span>
          <textarea
            className="plan-textarea"
            rows={3}
            value={roleTaskForm.taskDescription}
            onChange={(event) => setRoleTaskForm((prev) => ({ ...prev, taskDescription: event.target.value }))}
          />
        </label>
        <label className="plan-field plan-field--span">
          <span>Expected Outcome</span>
          <textarea
            className="plan-textarea"
            rows={3}
            value={roleTaskForm.expectedOutcome}
            onChange={(event) => setRoleTaskForm((prev) => ({ ...prev, expectedOutcome: event.target.value }))}
          />
        </label>
      </div>
      <div className="plan-actions">
        <button type="button" className="plan-button" onClick={() => void onCreate()} disabled={isSaving}>
          Add Role Task
        </button>
      </div>
    </article>
  </div>
);
