'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import type { InternalModule, RoleKey } from '../types/internal';
import { getInternalDashboardPath } from '../utils/internalRoutes';
import { roles, requisitionRoleGuidance, thresholdBands } from '../data/internalData';
import { useRecentActivity, formatRelativeTime } from '../hooks/useRecentActivity';
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
  Calendar,
  Zap,
  Bell,
  Activity,
  Settings
} from 'lucide-react';
import './DashboardPage.css';

interface DashboardProps {
  modules: InternalModule[];
  role?: RoleKey | null;
  userEmail?: string | null;
}

// Role-specific dashboard configurations
const roleDashboardConfig: Partial<Record<RoleKey, {
  title: string;
  subtitle: string;
  primaryMetrics: { label: string; value: string; trend?: string; icon: React.ReactNode }[];
  quickActions: { label: string; moduleId: string; icon: React.ReactNode }[];
  alerts: { type: 'warning' | 'info' | 'success'; message: string }[];
}>> = {
  requisitioning_officer: {
    title: 'Requisitioning Officer Workspace',
    subtitle: 'Create and manage departmental procurement requests',
    primaryMetrics: [
      { label: 'My Requisitions', value: '12', trend: '+3 this month', icon: <FileText /> },
      { label: 'Pending Approval', value: '4', icon: <Clock /> },
      { label: 'Approved', value: '8', trend: '67% success rate', icon: <CheckCircle /> }
    ],
    quickActions: [
      { label: 'Needs Assessment', moduleId: 'needs-collection', icon: <FileText /> },
      { label: 'Create New Requisition', moduleId: 'create-requisition', icon: <Zap /> },
      { label: 'View Requisition History', moduleId: 'requisition-history', icon: <Clock /> },
      { label: 'Track Requests', moduleId: 'requisition-tracking', icon: <TrendingUp /> }
    ],
    alerts: [
      { type: 'warning', message: '2 requisitions awaiting departmental endorsement' }
    ]
  },
  department_head: {
    title: 'Department Head Dashboard',
    subtitle: 'Review and endorse departmental requisitions',
    primaryMetrics: [
      { label: 'Pending Review', value: '5', icon: <AlertTriangle /> },
      { label: 'Endorsed This Month', value: '12', icon: <CheckCircle /> },
      { label: 'Team Requisitions', value: '24', icon: <FileText /> }
    ],
    quickActions: [
      { label: 'Needs Assessment', moduleId: 'needs-collection', icon: <Shield /> },
      { label: 'Review Pending Requisitions', moduleId: 'department-head-review', icon: <Shield /> },
      { label: 'View Team History', moduleId: 'requisition-history', icon: <Clock /> }
    ],
    alerts: [
      { type: 'warning', message: '3 requisitions require urgent review' }
    ]
  },
  comptroller_procurement: {
    title: 'Comptroller Procurement Dashboard',
    subtitle: 'Oversee procurement planning and committee reviews',
    primaryMetrics: [
      { label: 'Planning Committee Queue', value: '8', icon: <Briefcase /> },
      { label: 'APP Items', value: '156', icon: <FileText /> },
      { label: 'Active Tenders', value: '12', icon: <TrendingUp /> }
    ],
    quickActions: [
      { label: 'Needs Assessment', moduleId: 'needs-collection', icon: <Shield /> },
      { label: 'Planning Committee Review', moduleId: 'procurement-planning-committee', icon: <Shield /> },
      { label: 'Annual Procurement Plan', moduleId: 'annual-procurement-plan', icon: <Calendar /> },
      { label: 'Tender Management', moduleId: 'create-tender', icon: <Briefcase /> }
    ],
    alerts: [
      { type: 'info', message: 'Next planning committee meeting scheduled for tomorrow' }
    ]
  },
  financial_unit_officer: {
    title: 'Budget Officer Dashboard',
    subtitle: 'Manage budget alignment and appropriation controls',
    primaryMetrics: [
      { label: 'Budget Queue', value: '6', icon: <Clock /> },
      { label: 'Released This Month', value: '₦45.2M', trend: 'On track', icon: <CheckCircle /> },
      { label: 'Commitments', value: '₦128.5M', icon: <FileText /> }
    ],
    quickActions: [
      { label: 'Budget Workspace', moduleId: 'budget-workspace', icon: <Briefcase /> },
      { label: 'View Commitments', moduleId: 'budget-workspace', icon: <FileText /> }
    ],
    alerts: [
      { type: 'warning', message: '2 items require budget realignment' }
    ]
  },
  tenders_board: {
    title: 'Tenders Board Dashboard',
    subtitle: 'High-value procurement oversight and decisions',
    primaryMetrics: [
      { label: 'Board Review Queue', value: '4', icon: <Shield /> },
      { label: 'BPP Escalations', value: '2', icon: <AlertTriangle /> },
      { label: 'Approved Awards', value: '18', icon: <CheckCircle /> }
    ],
    quickActions: [
      { label: 'Board Approvals', moduleId: 'tenders-board-approval', icon: <Shield /> },
      { label: 'BPP Escalations', moduleId: 'bpp-escalation', icon: <AlertTriangle /> }
    ],
    alerts: [
      { type: 'warning', message: '1 high-value tender requires board decision' }
    ]
  },
  accounting_officer: {
    title: 'CGIS Executive Dashboard',
    subtitle: 'Direct approval authority and executive oversight',
    primaryMetrics: [
      { label: 'Pending CGIS Approval', value: '3', icon: <Clock /> },
      { label: 'Direct Approvals', value: '24', trend: 'This month', icon: <CheckCircle /> },
      { label: 'Executive Decisions', value: '156', icon: <Shield /> }
    ],
    quickActions: [
      { label: 'CGIS Approvals', moduleId: 'cgis-approval', icon: <Shield /> },
      { label: 'View Board Decisions', moduleId: 'tenders-board-approval', icon: <Briefcase /> }
    ],
    alerts: [
      { type: 'info', message: 'Monthly executive summary available' }
    ]
  },
  audit_oversight: {
    title: 'Audit Oversight Dashboard',
    subtitle: 'Compliance monitoring and traceability controls',
    primaryMetrics: [
      { label: 'Active Audits', value: '8', icon: <Shield /> },
      { label: 'Compliance Score', value: '94%', trend: 'Above target', icon: <CheckCircle /> },
      { label: 'Exceptions', value: '3', icon: <AlertTriangle /> }
    ],
    quickActions: [
      { label: 'Audit Dashboard', moduleId: 'audit-dashboard', icon: <Shield /> },
      { label: 'Audit Trail Viewer', moduleId: 'audit-trail-viewer', icon: <FileText /> },
      { label: 'Compliance Reports', moduleId: 'compliance-reports', icon: <TrendingUp /> }
    ],
    alerts: [
      { type: 'info', message: 'Quarterly compliance review due in 5 days' }
    ]
  },
  ict_admin: {
    title: 'ICT Admin Dashboard',
    subtitle: 'Platform administration and access management',
    primaryMetrics: [
      { label: 'Active Users', value: '247', icon: <User /> },
      { label: 'System Health', value: '99.9%', trend: 'Operational', icon: <CheckCircle /> },
      { label: 'Pending Access', value: '5', icon: <Clock /> }
    ],
    quickActions: [
      { label: 'User Management', moduleId: 'user-management', icon: <User /> },
      { label: 'System Monitoring', moduleId: 'system-monitoring', icon: <Shield /> },
      { label: 'Threshold Configuration', moduleId: 'threshold-configuration', icon: <Briefcase /> }
    ],
    alerts: [
      { type: 'success', message: 'All systems operational' }
    ]
  }
};

// Default dashboard config
const defaultConfig = {
  title: 'Procurement Dashboard',
  subtitle: 'Welcome to the CentralProcure internal workspace',
  primaryMetrics: [
    { label: 'Accessible Modules', value: '0', trend: undefined as string | undefined, icon: <Briefcase /> },
    { label: 'Active Workflows', value: '0', trend: undefined as string | undefined, icon: <TrendingUp /> },
    { label: 'Pending Items', value: '0', trend: undefined as string | undefined, icon: <Clock /> }
  ],
  quickActions: [] as { label: string; moduleId: string; icon: React.ReactNode }[],
  alerts: [] as { type: 'warning' | 'info' | 'success'; message: string }[]
};

// Activity icon mapper
const ActivityIcon: React.FC<{ type: 'requisition' | 'approval' | 'tender' | 'bid' | 'system'; className?: string }> = ({ type, className }) => {
  switch (type) {
    case 'requisition':
      return <FileText className={className} />;
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

export const DashboardPage = ({ modules, role, userEmail }: DashboardProps) => {
  const config = role ? (roleDashboardConfig[role] || defaultConfig) : defaultConfig;
  const roleInfo = role ? roles.find(r => r.key === role) : null;
  const guidance = role ? requisitionRoleGuidance[role] : null;
  const { activities, loading: activitiesLoading } = useRecentActivity(role, 5);

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
            {roleInfo && (
              <span className="dashboard-welcome__role-badge">
                <Shield className="w-3 h-3" />
                {roleInfo.name}
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

      {/* Role Guidance */}
      {guidance && (
        <section className="dashboard-guidance">
          <h2 className="dashboard-section-title">Role Guidance</h2>
          <div className="dashboard-guidance__card">
            <h3 className="dashboard-guidance__focus">{guidance.focus}</h3>
            <ul className="dashboard-guidance__checks">
              {guidance.checks.map((check, index) => (
                <li key={index}>
                  <CheckCircle className="w-4 h-4" />
                  {check}
                </li>
              ))}
            </ul>
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
                <div className="dashboard-threshold-card__item">
                  <span className="dashboard-threshold-card__item-label">Timeline</span>
                  <span className="dashboard-threshold-card__item-value">{band.timeline}</span>
                </div>
              </div>
              <div className="dashboard-threshold-card__steps">
                {band.steps.map((step, idx) => (
                  <span key={idx} className="dashboard-threshold-card__step">
                    {step}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
