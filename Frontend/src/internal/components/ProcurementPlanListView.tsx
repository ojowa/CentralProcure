import type { YearlyAppSummary } from '../services/procurementPlanService';

type Props = {
  yearlyApps: YearlyAppSummary[];
  filteredYearlyApps: YearlyAppSummary[];
  query: string;
  canCreateApp?: boolean;
  statusCounts: Record<string, number>;
  onQueryChange: (value: string) => void;
  onOpenYearlyApp: (yearlyAppId: string) => void;
  onCreateYearlyApp: () => void;
};

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value);

export const ProcurementPlanListView = ({
  yearlyApps,
  filteredYearlyApps,
  query,
  canCreateApp,
  statusCounts,
  onQueryChange,
  onOpenYearlyApp,
  onCreateYearlyApp
}: Props) => (
  <>
    <div className="app-stats-grid">
      <div className="app-stat-card">
        <div className="app-stat-card__value">{yearlyApps.length}</div>
        <div className="app-stat-card__label">Total Yearly APPs</div>
      </div>
      <div className="app-stat-card app-stat-card--warning">
        <div className="app-stat-card__value">{statusCounts['Under Review'] ?? 0}</div>
        <div className="app-stat-card__label">Under Review</div>
      </div>
      <div className="app-stat-card app-stat-card--info">
        <div className="app-stat-card__value">{statusCounts['Submitted'] ?? 0}</div>
        <div className="app-stat-card__label">Submitted</div>
      </div>
      <div className="app-stat-card app-stat-card--success">
        <div className="app-stat-card__value">{statusCounts['Approved'] ?? 0}</div>
        <div className="app-stat-card__label">Approved</div>
      </div>
    </div>

    <div className="app-card">
      <div className="app-card__header">
        <h3 className="app-card__title">Annual Procurement Plans</h3>
        <div className="app-card__actions">
          <div className="app-search">
            <span className="app-search__icon">🔍</span>
            <input
              className="app-search__input"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search by title, status, or fiscal year..."
            />
          </div>
          {canCreateApp && (
            <button className="app-btn app-btn--primary" onClick={onCreateYearlyApp}>
              <span className="app-btn__icon">+</span>
              Create Yearly APP
            </button>
          )}
        </div>
      </div>

      <div className="app-table-wrapper">
        <table className="app-table">
          <thead>
            <tr>
              <th>APP Title</th>
              <th>Fiscal Year</th>
              <th>Status</th>
              <th>Approved Plans</th>
              <th>Items</th>
              <th>Total Budget</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredYearlyApps.map((app) => (
              <tr key={app.YearlyAppId} className="app-table__row">
                <td className="app-table__cell app-table__cell--strong">{app.Title}</td>
                <td className="app-table__cell">{app.FiscalYear}</td>
                <td className="app-table__cell">
                  <span className={`app-badge app-badge--${app.Status.toLowerCase().replace(' ', '-')}`}>
                    {app.Status}
                  </span>
                </td>
                <td className="app-table__cell">{app.IncludedPlansCount}</td>
                <td className="app-table__cell">{app.ItemsCount}</td>
                <td className="app-table__cell app-table__cell--numeric">{money(app.TotalBudget)}</td>
                <td className="app-table__cell">
                  <button className="app-btn app-btn--sm" onClick={() => onOpenYearlyApp(app.YearlyAppId)}>
                    Open APP
                  </button>
                </td>
              </tr>
            ))}
            {filteredYearlyApps.length === 0 && (
              <tr>
                <td colSpan={7} className="app-table__empty">
                  <div className="app-empty-state">
                    <span className="app-empty-state__icon">📋</span>
                    <p>No yearly APPs match your search.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </>
);
