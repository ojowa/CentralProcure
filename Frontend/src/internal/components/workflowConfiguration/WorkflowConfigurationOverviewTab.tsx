type Props = {
  phaseCounts: Record<string, number>;
  transitionsCount: number;
  roleTasksCount: number;
  boardBandCount: number;
  governanceBodyCount: number;
  toTitle: (value: string) => string;
};

export const WorkflowConfigurationOverviewTab = ({
  phaseCounts,
  transitionsCount,
  roleTasksCount,
  boardBandCount,
  governanceBodyCount,
  toTitle
}: Props) => (
  <div className="admin-grid">
    <article className="admin-card admin-card--wide">
      <h3>Phase Coverage</h3>
      <ul className="admin-list">
        {Object.entries(phaseCounts).map(([phaseKey, count]) => (
          <li key={phaseKey}>
            <div>
              <strong>{toTitle(phaseKey)}</strong>
              <span>Configured workflow stages</span>
            </div>
            <span className="admin-status admin-status--good">{count}</span>
          </li>
        ))}
      </ul>
    </article>
    <article className="admin-card admin-card--mid">
      <h3>Signals</h3>
      <ul className="admin-list">
        <li>
          <div>
            <strong>{transitionsCount}</strong>
            <span>Transitions</span>
          </div>
        </li>
        <li>
          <div>
            <strong>{roleTasksCount}</strong>
            <span>Role tasks</span>
          </div>
        </li>
        <li>
          <div>
            <strong>{boardBandCount}</strong>
            <span>Board bands</span>
          </div>
        </li>
        <li>
          <div>
            <strong>{governanceBodyCount}</strong>
            <span>Governance bodies</span>
          </div>
        </li>
      </ul>
    </article>
  </div>
);
