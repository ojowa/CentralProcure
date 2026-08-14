'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { RoleKey } from '../../types/internal';
import { getInternalDashboardPath } from '../../utils/internalRoutes';
import { formatRelativeTime } from '../../utils/formatUtils';
import { fetchInternalDashboard } from '../../services/dashboardService';
import type { InternalDashboardResponse } from '../../types/internal';
import {
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

const getQuickActionIcon = (moduleId: string): React.ReactNode => {
  if (moduleId.includes('budget')) return <Briefcase className="w-5 h-5" />;
  if (moduleId.includes('audit') || moduleId.includes('compliance')) return <Shield className="w-5 h-5" />;
  if (moduleId.includes('tender') || moduleId.includes('evaluation')) return <TrendingUp className="w-5 h-5" />;
  if (moduleId.includes('approval') || moduleId.includes('cgis') || moduleId.includes('board')) return <CheckCircle className="w-5 h-5" />;
  if (moduleId.includes('profile') || moduleId.includes('user')) return <User className="w-5 h-5" />;
  return <FileText className="w-5 h-5" />;
};

export const DashboardPage = ({ role, userEmail, userFirstName, userSurname, roleName, token }: DashboardProps) => {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load dashboard summary.';
      setDashboardError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    const handler = () => loadDashboard();
    window.addEventListener('notification:read', handler);
    return () => window.removeEventListener('notification:read', handler);
  }, [loadDashboard]);

  const config = {
    title: dashboard?.Title ?? 'Procurement Dashboard',
    subtitle: dashboard?.Subtitle ?? 'Welcome to NIS eProcurement Portal',
    primaryMetrics: (dashboard?.Metrics ?? []).map((metric) => ({
      label: metric.label,
      value: metric.value,
      trend: metric.trend,
      icon: getMetricIcon(metric.label)
    })),
    quickActions: (dashboard?.QuickActions ?? []).map((action) => ({
      label: action.label,
      moduleId: action.moduleId,
      icon: getQuickActionIcon(action.moduleId)
    })),
    alerts: (dashboard?.Alerts ?? []) as { type: 'warning' | 'info' | 'success'; message: string }[],
    activities: (dashboard?.RecentActivity ?? []).map((a) => ({
      ...a,
      type: a.type ?? 'system' as const
    }))
  };
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

      {/* Quick Actions */}
      {config.quickActions.length > 0 && (
        <section className="dashboard-quick-actions">
          <h2 className="dashboard-section-title">Quick Actions</h2>
          <div className="dashboard-quick-actions__grid">
            {config.quickActions.map((action, index) => (
              <Link
                key={index}
                href={getInternalDashboardPath(action.moduleId)}
                className="dashboard-quick-action"
              >
                <span className="dashboard-quick-action__icon">{action.icon}</span>
                <span className="dashboard-quick-action__label">{action.label}</span>
                <ArrowRight className="dashboard-quick-action__arrow" />
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};

export default DashboardPage;
