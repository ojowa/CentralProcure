export interface InternalDashboardMetric {
  label: string;
  value: string;
  trend?: string;
}

export interface InternalDashboardQuickAction {
  label: string;
  moduleId: string;
}

export interface InternalDashboardAlert {
  type: 'warning' | 'info' | 'success';
  message: string;
}

export interface InternalDashboardActivity {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status?: 'completed' | 'pending' | 'in_progress' | 'rejected';
}

export interface InternalDashboardResponse {
  Role: string;
  Title: string;
  Subtitle: string;
  Metrics: InternalDashboardMetric[];
  QuickActions: InternalDashboardQuickAction[];
  Alerts: InternalDashboardAlert[];
  Thresholds: ThresholdBandData[];
  RecentActivity: InternalDashboardActivity[];
}

export interface ThresholdBandData {
  id: string;
  label: string;
  min: number;
  max: number;
  approvalLevel: string;
  timeline: string;
  requiresBpp: boolean;
  escalation: string;
  steps: string[];
}
