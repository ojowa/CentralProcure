'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { InternalModule, RoleKey } from '../types/internal';
import { getInternalDashboardPath } from '../utils/internalRoutes';
import { useRecentActivity, formatRelativeTime } from '../hooks/useRecentActivity';
import { fetchInternalDashboard } from '../services/dashboardService';
import type { InternalDashboardResponse } from '../types/internal';
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
  Settings
} from 'lucide-react';
import './DashboardPage.css';

interface DashboardProps {
  modules: InternalModule[];
  role?: RoleKey | null;
  userEmail?: string | null;
  roleName?: string | null;
  token?: string | null;
}

// Icon mapper for metrics
const getMetricIcon = (label: string): React.ReactNode => {
  if (label.toLowerCase().includes('module')) {
    return <Briefcase className="w-5 h-5" />;
  }
  if (label.toLowerCase().includes('notification')) {
    return <Bell className="w-5 h-5" />;
  }
  if (label.toLowerCase().includes('threshold')) {
    return <Shield className="w-5 h-5" />;
  }
  if (label.toLowerCase().includes('pending')) {
    return <Clock className="w-5 h-5" />;
  }
  if (label.toLowerCase().includes('approval') || label.toLowerCase().includes('released')) {
    return <CheckCircle className="w-5 h-5" />;
  }
  return <TrendingUp className="w-5 h-5" />;
};

// Icon mapper for quick actions
const getQuickActionIcon = (moduleId: string): React.ReactNode => {
  if (moduleId.includes('budget')) {
    return <Briefcase className="w-5 h-5" />;
  }
  if (moduleId.includes('audit') || moduleId.includes('compliance')) {
    return <Shield className="w-5 h-5" />;
  }
  if (moduleId.includes('tender') || moduleId.includes('evaluation')) {
    return <TrendingUp className="w-5 h-5" />;
  }
  if (moduleId.includes('approval') || moduleId.includes('cgis') || moduleId.includes('board')) {
    return <CheckCircle className="w-5 h-5" />;
  }
  if (moduleId.includes('profile') || moduleId.includes('user')) {
    return <User className="w-5 h-5" />;
  }
  return <FileText className="w-5 h-5" />;
};

// Activity icon mapper
const ActivityIcon: React.FC<{ type: 'approval' | 'tender' | 'bid' | 'system'; className?: string }> = ({ type, className }) => {
  switch (type) {
    case 'approval':
      return <CheckCircle className={className} />;
    case 'tender':
      return <Briefcase className={className} />;
    case 'bid':
      return <TrendingUp className={className} />;
    case 'system':
      return <Settings className={className} />;
    default:
      return <Activity className={className} />;
  }
};

// Status color mapper
const getStatusColor = (status?: 'completed' | 'pending' | 'in_progress' | 'rejected') => {
  switch (status) {
    case 'completed':
      return '#0b5d3b';
    case 'pending':
      return '#f59e0b';
    case 'in_progress':
      return '#3b82f6';
    case 'rejected':
      return '#dc2626';
    default:
      return '#64748b';
  }
};

export const DashboardPage = ({ modules, role, userEmail, roleName, token }: DashboardProps) => {
  const resolvedRoleName = roleName || (role ? role.replace(/_/g, ' ') : null);
  const { activities, loading: activitiesLoading } = useRecentActivity(token, 5);

  const [dashboard, setDashboard] = useState<InternalDashboardResponse | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setDashboard(null);
      setDashboardError(null);
      return;
    }

    let isMounted = true;
    setDashboardError(null);

    fetchInternalDashboard(token)
      .then((data) => {
        if (isMounted) {
          setDashboard(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDashboardError('Unable to load dashboard summary.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const config = {
    title: dashboard?.Title ?? 'Procurement Dashboard',
    subtitle: dashboard?.Subtitle ?? 'Welcome to the CentralProcure internal workspace',
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
    alerts: (dashboard?.Alerts ?? []) as { type: 'warning' | 'info' | 'success'; message: string }[]
  };
  const thresholdBands = dashboard?.Thresholds ?? [];

  // Group modules by section
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
        'Account Management': 900,
        'Requisitioning Departments': 800,
        'Procurement Planning': 700
      };
      return (weights[b] || 0) - (weights[a] || 0);
    });
  }, [modules]);

  const moduleCount = modules.length;
  const sectionCount = new Set(modules.map(m => m.section)).size;

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="dashboard-page">
      {/* Welcome Header */}
      <section className="dashboard-welcome">
        <div className="dashboard-welcome__content">
          <div className="dashboard-welcome__text">
            <p className="dashboard-welcome__greeting">
              {getGreeting()}, {userEmail?.split('@')[0] || 'User'}
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
        <div className="portal-alert">{dashboardError}</div>
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
        </section>
      )}

      {/* Recent Activity */}
      {activities.length > 0 && (
        <section className="dashboard-activity">
          <h2 className="dashboard-section-title">Recent Activity</h2>
          <div className="dashboard-activity__list">
            {activitiesLoading ? (
              <div className="dashboard-activity__loading">Loading activities...</div>
            ) : (
              activities.map((activity) => (
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
              ))
            )}
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
      <section className="dashboard-thresholds">
        <h2 className="dashboard-section-title">Procurement Thresholds</h2>
        <div className="dashboard-thresholds__grid">
          {thresholdBands.length === 0 ? (
            <div className="dashboard-threshold-card">
              <div className="dashboard-threshold-card__header">
                <h3 className="dashboard-threshold-card__label">No threshold data available</h3>
              </div>
            </div>
          ) : (
            thresholdBands.map((band) => (
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
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
