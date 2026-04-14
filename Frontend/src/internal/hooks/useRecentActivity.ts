'use client';

import { useState, useEffect } from 'react';
import type { RoleKey } from '../types/internal';

export interface Activity {
  id: string;
  type: 'requisition' | 'approval' | 'tender' | 'bid' | 'system';
  title: string;
  description: string;
  timestamp: string;
  status?: 'completed' | 'pending' | 'in_progress' | 'rejected';
}

// Mock activities generator based on role
const generateMockActivities = (role: RoleKey): Activity[] = {
  const now = new Date();
  const activities: Record<RoleKey, Activity[]> = {
    requisitioning_officer: [
      {
        id: '1',
        type: 'requisition',
        title: 'Requisition Submitted',
        description: 'REQ-2024-0156: Office Equipment Procurement',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      },
      {
        id: '2',
        type: 'approval',
        title: 'Requisition Endorsed',
        description: 'REQ-2024-0154: IT Infrastructure Upgrade',
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      },
      {
        id: '3',
        type: 'requisition',
        title: 'Requisition Created',
        description: 'REQ-2024-0157: Vehicle Maintenance Services',
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'in_progress'
      }
    ],
    department_head: [
      {
        id: '1',
        type: 'approval',
        title: 'Requisition Pending Review',
        description: 'REQ-2024-0156: Office Equipment Procurement',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      },
      {
        id: '2',
        type: 'approval',
        title: 'Requisition Endorsed',
        description: 'REQ-2024-0154: IT Infrastructure Upgrade',
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      }
    ],
    comptroller_procurement: [
      {
        id: '1',
        type: 'tender',
        title: 'Tender Published',
        description: 'TEN-2024-0042: Supply of Office Furniture',
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      },
      {
        id: '2',
        type: 'requisition',
        title: 'Planning Committee Review',
        description: '5 items queued for committee review',
        timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        status: 'in_progress'
      }
    ],
    financial_unit_officer: [
      {
        id: '1',
        type: 'approval',
        title: 'Budget Released',
        description: 'BUD-2024-023: Q4 Capital Projects',
        timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      },
      {
        id: '2',
        type: 'system',
        title: 'Budget Appropriation',
        description: 'New appropriation logged for Infrastructure Dept',
        timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      }
    ],
    tenders_board: [
      {
        id: '1',
        type: 'approval',
        title: 'Board Decision Required',
        description: '2 high-value tenders awaiting board review',
        timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      },
      {
        id: '2',
        type: 'approval',
        title: 'Tender Approved',
        description: 'TEN-2024-0038: Security Services Contract',
        timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      }
    ],
    accounting_officer: [
      {
        id: '1',
        type: 'approval',
        title: 'Direct Approval Required',
        description: '3 low-value requisitions pending CGIS approval',
        timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      },
      {
        id: '2',
        type: 'approval',
        title: 'Award Authorized',
        description: 'Contract for Generator Supply approved',
        timestamp: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      }
    ],
    audit_oversight: [
      {
        id: '1',
        type: 'system',
        title: 'Compliance Alert',
        description: '3 exceptions flagged in Q4 review',
        timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        status: 'in_progress'
      },
      {
        id: '2',
        type: 'system',
        title: 'Audit Trail Review',
        description: 'Monthly compliance report generated',
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      }
    ],
    ict_admin: [
      {
        id: '1',
        type: 'system',
        title: 'User Access Granted',
        description: 'New user registered: john.doe@nis.gov.ng',
        timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        status: 'completed'
      },
      {
        id: '2',
        type: 'system',
        title: 'System Update',
        description: 'Procurement module updated to v2.4.1',
        timestamp: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      }
    ],
    procurement_secretary: [
      {
        id: '1',
        type: 'system',
        title: 'Meeting Minutes',
        description: 'Planning Committee meeting minutes recorded',
        timestamp: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      }
    ],
    evaluation_committee: [
      {
        id: '1',
        type: 'bid',
        title: 'Bid Evaluation',
        description: '4 bids received for TEN-2024-0041',
        timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        status: 'in_progress'
      }
    ]
  };

  return activities[role] || [
    {
      id: '1',
      type: 'system',
      title: 'Welcome',
      description: 'Dashboard initialized for your role',
      timestamp: now.toISOString(),
      status: 'completed'
    }
  ];
};

export const useRecentActivity = (role: RoleKey | null, limit: number = 5) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role) {
      setActivities([]);
      setLoading(false);
      return;
    }

    // Simulate API call
    const timer = setTimeout(() => {
      const mockActivities = generateMockActivities(role);
      setActivities(mockActivities.slice(0, limit));
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [role, limit]);

  return { activities, loading };
};

// Format relative time
export const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
};

// Get activity icon based on type
export const getActivityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'requisition':
      return 'file-text';
    case 'approval':
      return 'check-circle';
    case 'tender':
      return 'briefcase';
    case 'bid':
      return 'trending-up';
    case 'system':
      return 'settings';
    default:
      return 'activity';
  }
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
