'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { InternalModule, RoleKey } from '../../types/internal';
import { getInternalDashboardPath } from '../../utils/internalRoutes';
import { formatRelativeTime } from '../../utils/formatUtils';
import { fetchInternalDashboard } from '../../services/dashboardService';
import type { InternalDashboardResponse } from '../../types/internal';
import {
  LayoutDashboard,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  User,
  Briefcase,
  Shield,
  TrendingUp,
  Bell,
  Activity,
  Settings,
  RefreshCw
} from 'lucide-react';
import './DashboardPage.css';

interface DashboardProps {
  modules: InternalModule[];
  role?: RoleKey | null;
  userEmail?: string | null;
  userFirstName?: string | null;
  userSurname?: string | null;
  roleName?: string | null;
  token?: string | null;
}

const getMetricIcon = (label: string): React.ReactNode => {
  const l = label.toLowerCase();
  if (l.includes('module')) return <Briefcase className="w-5 h-5" />;
  if (l.includes('notification')) return <Bell className="w-5 h-5" />;
  if (l.includes('threshold')) return <Shield className="w-5 h-5" />;
  if (l.includes('pending')) return <Clock className="w-5 h-5" />;
  if (l.includes('approval') || l.includes('released')) return <CheckCircle className="w-5 h-5" />;
  return <TrendingUp className="w-5 h-5" />;
};

const ActivityIcon: React.FC<{ type: 'approval' | 'tender' | 'bid' | 'system'; className?: string }> = ({ type, className }) => {
  switch (type) {
    case 'approval': return <CheckCircle className={className} />;
    case 'tender': return <Briefcase className={className} />;
    case 'bid': return <TrendingUp className={className} />;
    case 'system': return <Settings className={className} />;
    default: return <Activity className={className} />;
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'completed': return '#0b5d3b';
    case 'pending': return '#f59e0b';
    case 'in_progress': return '#3b82f6';
    case 'rejected': return '#dc2626';
    default: return '#64748b';
  }
};

export const DashboardPage = ({ modules, role, userEmail, userFirstName, userSurname, roleName, token }: DashboardProps) => {
  const resolvedRoleName = roleName || (role ? role.replace(/_/g, ' ') : null);

  const [dashboard, setDashboard] = useState<InternalDashboardResponse | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setDashboardError(null);
    try {
      const data = await fetchInternalDashboard(token);
      setDashboard(data);
    } catch {
      setDashboardError('Unable to load dashboard summary.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const config = {
    title: dashboard?.Title ?? 'Procurement Dashboard',
    subtitle: dashboard?.Subtitle ?? 'Welcome to the CentralProcure internal workspace',
    primaryMetrics: (dashboard?.Metrics ?? []).map((metric) => ({
      label: metric.label,
      value: metric.value,
      trend: metric.trend,
      icon: getMetricIcon(metric.label)
    })),
    alerts: (dashboard?.Alerts ?? []) as { type: 'warning' | 'info' | 'success'; message: string }[],
    activities: (dashboard?.RecentActivity ?? []).map((a) => ({
      ...a,
      type: a.type ?? 'system' as const
    }))
  };
  const thresholdBands = dashboard?.Thresholds ?? [];

  const groupedModules = useMemo(() => {
    const grouped = modules.reduce<Record<string, InternalModule[]>>((acc, module) => {
      let section = module.section;
      if (section === 'Governance & Approval' || section === 'Procurement Planning') {
        section = 'Governance and Planning';
      }
      acc[section] = acc[section] || [];
      acc[section].push(module);
      return acc;
    }, {});

    return Object.entries(grouped).sort(([a], [b]) => {
      const weights: Record<string, number> = {
        'Governance and Planning': 1000,
        'Account Management': 900
      };
      return (weights[b] || 0) - (weights[a] || 0);
    });
  }, [modules]);

  const moduleCount = modules.length;
  const sectionCount = groupedModules.length;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = userFirstName
    ? (userSurname ? `${userFirstName} ${userSurname}` : userFirstName)
    : (userEmail?.split('@')[0] || 'User');

  if (isLoading && !dashboard) {
    return (
      <div className="dashboard-page">
        <section className="dashboard-welcome">
          <div className="dashboard-welcome__content">
            <div className="dashboard-welcome__text">
              <div className="dashboard-skeleton dashboard-skeleton--text" style={{ width: '200px', height: '16px', marginBottom: '8px' }} />
              <div className="dashboard-skeleton dashboard-skeleton--title" style={{ width: '300px', height: '28px', marginBottom: '8px' }} />
              <div className="dashboard-skeleton dashboard-skeleton--text" style={{ width: '400px', height: '14px' }} />
            </div>
          </div>
        </section>
        <section className="dashboard-metrics">
          {[1, 2, 3].map(i => (
            <div key={i} className="dashboard-metric-card">
              <div className="dashboard-skeleton dashboard-skeleton--icon" />
              <div className="dashboard-metric-card__content">
                <div className="dashboard-skeleton dashboard-skeleton--text" style={{ width: '40px', height: '24px' }} />
                <div className="dashboard-skeleton dashboard-skeleton--text" style={{ width: '100px', height: '12px', marginTop: '4px' }} />
              </div>
            </div>
          ))}
        </section>
        <section className="dashboard-modules">
          <div className="dashboard-skeleton dashboard-skeleton--text" style={{ width: '180px', height: '20px', marginBottom: '16px' }} />
          <div className="dashboard-modules__sections">
            {[1, 2].map(s => (
              <div key={s} className="dashboard-section">
                <div className="dashboard-skeleton dashboard-skeleton--text" style={{ width: '150px', height: '16px', marginBottom: '12px' }} />
                <div className="dashboard-section__grid">
                  {[1, 2, 3].map(c => (
                    <div key={c} className="dashboard-module-card">
                      <div className="dashboard-skeleton dashboard-skeleton--text" style={{ width: '70%', height: '16px' }} />
                      <div className="dashboard-skeleton dashboard-skeleton--text" style={{ width: '100%', height: '12px', marginTop: '8px' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Welcome Header */}
      <section className="dashboard-welcome">
        <div className="dashboard-welcome__content">
          <div className="dashboard-welcome__text">
            <p className="dashboard-welcome__greeting">
              {getGreeting()}, {displayName}
            </p>
            <h1 className="dashboard-welcome__title">{config.title}</h1>
            <p className="dashboard-welcome__subtitle">{config.subtitle}</p>
            {resolvedRoleName && (
              <span className="dashboard-welcome__role-badge">
                <Shield className="w-3 h-3" />
                {resolvedRoleName}
              </span>
            )}
          </div>
          <div className="dashboard-welcome__actions">
            <Link
              href={getInternalDashboardPath('user-profile')}
              className="dashboard-welcome__profile-link"
            >
              <User className="w-4 h-4" />
              My Profile
            </Link>
          </div>
        </div>
      </section>

      {/* Primary Metrics */}
      {dashboardError ? (
        <div className="portal-alert" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>{dashboardError}</span>
          <button
            type="button"
            className="plan-button plan-button--secondary"
            style={{ fontSize: '0.75rem', padding: '4px 12px' }}
            onClick={() => void loadDashboard()}
          >
            <RefreshCw className="w-3 h-3" style={{ marginRight: '4px' }} />
            Retry
          </button>
        </div>
      ) : (
        <section className="dashboard-metrics">
          {config.primaryMetrics.map((metric, index) => (
            <div key={index} className="dashboard-metric-card">
              <div className="dashboard-metric-card__icon">{metric.icon}</div>
              <div className="dashboard-metric-card__content">
                <span className="dashboard-metric-card__value">{metric.value}</span>
                <span className="dashboard-metric-card__label">{metric.label}</span>
                {metric.trend && (
                  <span className="dashboard-metric-card__trend">{metric.trend}</span>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Alerts */}
      {config.alerts.length > 0 && (
        <section className="dashboard-alerts">
          {config.alerts.map((alert, index) => (
            <div key={index} className={`dashboard-alert dashboard-alert--${alert.type}`}>
              {alert.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
              {alert.type === 'info' && <Bell className="w-5 h-5" />}
              {alert.type === 'success' && <CheckCircle className="w-5 h-5" />}
              <span>{alert.message}</span>
            </div>
          ))}
          {config.alerts.length >= 5 && (
            <Link href="/internal/dashboard/audit-trail-viewer" className="dashboard-alert__view-all">
              View all notifications <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </section>
      )}

      {/* Recent Activity */}
      {config.activities.length > 0 && (
        <section className="dashboard-activity">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="dashboard-section-title">Recent Activity</h2>
            <Link href="/internal/dashboard/audit-trail-viewer" className="dashboard-activity__view-all">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="dashboard-activity__list">
            {config.activities.map((activity) => (
              <div key={activity.id} className="dashboard-activity__item">
                <div
                  className="dashboard-activity__icon"
                  style={{ color: getStatusColor(activity.status) }}
                >
                  <ActivityIcon type={activity.type} className="w-5 h-5" />
                </div>
                <div className="dashboard-activity__content">
                  <div className="dashboard-activity__header">
                    <span className="dashboard-activity__title">{activity.title}</span>
                    <span className="dashboard-activity__time">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                  <p className="dashboard-activity__description">{activity.description}</p>
                </div>
                {activity.status && (
                  <span
                    className="dashboard-activity__status"
                    style={{
                      backgroundColor: `${getStatusColor(activity.status)}20`,
                      color: getStatusColor(activity.status)
                    }}
                  >
                    {activity.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modules Grid */}
      <section className="dashboard-modules">
        <div className="dashboard-modules__header">
          <h2 className="dashboard-section-title">Accessible Modules</h2>
          <div className="dashboard-modules__stats">
            <span className="dashboard-modules__stat">
              <strong>{moduleCount}</strong> modules
            </span>
            <span className="dashboard-modules__stat">
              <strong>{sectionCount}</strong> sections
            </span>
          </div>
        </div>

        {groupedModules.length === 0 ? (
          <div className="dashboard-empty">
            <LayoutDashboard className="w-16 h-16" />
            <h3>No Modules Available</h3>
            <p>Your role currently has no accessible modules.</p>
          </div>
        ) : (
          <div className="dashboard-modules__sections">
            {groupedModules.map(([section, sectionModules]) => (
              <div key={section} className="dashboard-section">
                <h3 className="dashboard-section__title">{section}</h3>
                <div className="dashboard-section__grid">
                  {sectionModules.map((module) => (
                    <Link
                      key={module.id}
                      href={getInternalDashboardPath(module.id)}
                      className="dashboard-module-card"
                    >
                      <div className="dashboard-module-card__header">
                        <h4 className="dashboard-module-card__title">{module.title}</h4>
                        <ArrowRight className="dashboard-module-card__arrow" />
                      </div>
                      <p className="dashboard-module-card__description">
                        {module.description}
                      </p>
                      <div className="dashboard-module-card__meta">
                        <span className="dashboard-module-card__microservice">
                          {module.microservice}
                        </span>
                        {module.actions && module.actions.length > 0 && (
                          <span className="dashboard-module-card__actions">
                            {module.actions.length} actions
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Threshold Information */}
      {thresholdBands.length > 0 && (
        <section className="dashboard-thresholds">
          <h2 className="dashboard-section-title">Procurement Thresholds</h2>
          <div className="dashboard-thresholds__grid">
            {thresholdBands.map((band) => (
              <div key={band.id} className="dashboard-threshold-card">
                <div className="dashboard-threshold-card__header">
                  <h3 className="dashboard-threshold-card__label">{band.label}</h3>
                  <span className={`dashboard-threshold-card__badge ${band.requiresBpp ? 'dashboard-threshold-card__badge--bpp' : ''}`}>
                    {band.requiresBpp ? 'BPP Required' : 'Internal'}
                  </span>
                </div>
                <div className="dashboard-threshold-card__details">
                  <div className="dashboard-threshold-card__item">
                    <span className="dashboard-threshold-card__item-label">Approval</span>
                    <span className="dashboard-threshold-card__item-value">{band.approvalLevel}</span>
                  </div>
                  {band.timeline && (
                    <div className="dashboard-threshold-card__item">
                      <span className="dashboard-threshold-card__item-label">Timeline</span>
                      <span className="dashboard-threshold-card__item-value">{band.timeline}</span>
                    </div>
                  )}
                  {band.escalation && (
                    <div className="dashboard-threshold-card__item">
                      <span className="dashboard-threshold-card__item-label">Escalation</span>
                      <span className="dashboard-threshold-card__item-value">{band.escalation}</span>
                    </div>
                  )}
                </div>
                {band.steps.length > 0 && (
                  <div className="dashboard-threshold-card__steps">
                    {band.steps.map((step, idx) => (
                      <span key={idx} className="dashboard-threshold-card__step">
                        {step}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;
