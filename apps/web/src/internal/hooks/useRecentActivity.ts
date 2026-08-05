'use client';

import { useState, useEffect } from 'react';
import type { InternalDashboardActivity } from '../types/internal';
import { fetchInternalDashboard } from '../services/dashboardService';

export type ActivityType = 'approval' | 'tender' | 'bid' | 'system';

export interface Activity extends InternalDashboardActivity {
  type: ActivityType;
}

export const useRecentActivity = (token: string | null | undefined, limit: number = 5) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setActivities([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetchInternalDashboard(token)
      .then((dashboard) => {
        if (!isMounted) {
          return;
        }

        setActivities(
          dashboard.RecentActivity.slice(0, limit).map((item) => ({
            ...item,
            type: 'system' as ActivityType
          }))
        );
      })
      .catch(() => {
        if (isMounted) {
          setActivities([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, limit]);

  return { activities, loading };
};

// Format relative time
export const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
};

// Get status color
export const getStatusColor = (status?: Activity['status']) => {
  switch (status) {
    case 'completed':
      return 'var(--portal-forest, #0b5d3b)';
    case 'pending':
      return '#f59e0b';
    case 'in_progress':
      return '#3b82f6';
    case 'rejected':
      return '#dc2626';
    default:
      return 'var(--portal-slate, #64748b)';
  }
};