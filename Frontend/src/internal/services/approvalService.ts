import type { ApprovalSummary, ApprovalDetail } from '../types/internal';

interface PaginatedResponse<T> {
  Items: T[];
  Total: number;
}

export const fetchApprovals = async (
  token: string,
  filters?: {
    query?: string;
    status?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<PaginatedResponse<ApprovalSummary>> => {
  // For now, we'll return mock data to simulate the API response
  // In a real implementation, this would call the actual backend endpoint
  
  const query = filters?.query?.toLowerCase() || '';
  const statusFilter = filters?.status || '';
  const categoryFilter = filters?.category || '';
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 10;
  
  // Mock data simulating approvals
  const mockApprovals: ApprovalSummary[] = [
    {
      ApprovalId: 'APP-001',
      Title: 'Office Equipment Procurement Approval',
      Description: 'Approval request for new office equipment procurement',
      Category: 'Office Supplies',
      Status: 'Pending',
      SubmittedBy: 'john.doe@gov.ng',
      SubmittedOn: '2026-03-15T10:30:00Z',
      Amount: 250000,
      Priority: 'Medium'
    },
    {
      ApprovalId: 'APP-002',
      Title: 'IT Infrastructure Upgrade',
      Description: 'Approval for upgrading department IT infrastructure',
      Category: 'Technology',
      Status: 'Approved',
      SubmittedBy: 'jane.smith@gov.ng',
      SubmittedOn: '2026-03-10T14:15:00Z',
      Amount: 1500000,
      Priority: 'High'
    },
    {
      ApprovalId: 'APP-003',
      Title: 'Vehicle Fleet Maintenance',
      Description: 'Approval for quarterly vehicle fleet maintenance',
      Category: 'Transportation',
      Status: 'Rejected',
      SubmittedBy: 'mike.johnson@gov.ng',
      SubmittedOn: '2026-03-05T09:00:00Z',
      Amount: 75000,
      Priority: 'Low'
    }
  ];
  
  // Apply filters
  let filteredApprovals = mockApprovals;
  
  if (query) {
    filteredApprovals = filteredApprovals.filter(approval =>
      approval.Title.toLowerCase().includes(query) ||
      approval.Description.toLowerCase().includes(query) ||
      approval.Category.toLowerCase().includes(query)
    );
  }
  
  if (statusFilter) {
    filteredApprovals = filteredApprovals.filter(approval => 
      approval.Status.toLowerCase() === statusFilter.toLowerCase()
    );
  }
  
  if (categoryFilter) {
    filteredApprovals = filteredApprovals.filter(approval => 
      approval.Category.toLowerCase() === categoryFilter.toLowerCase()
    );
  }
  
  // Apply pagination
  const startIndex = (page - 1) * pageSize;
  const paginatedApprovals = filteredApprovals.slice(startIndex, startIndex + pageSize);
  
  // Return mock response
  return {
    Items: paginatedApprovals,
    Total: filteredApprovals.length
  };
};

// Mock function for fetching approval details
export const fetchApprovalDetail = async (
  token: string,
  approvalId: string
): Promise<ApprovalDetail | null> => {
  // In a real implementation, this would call the actual backend endpoint
  // For now, we'll return mock data
  
  const mockDetail: ApprovalDetail = {
    ApprovalId: approvalId,
    Title: 'Sample Approval Request',
    Description: 'This is a detailed approval request for review purposes.',
    Category: 'Sample Category',
    Status: 'Pending',
    SubmittedBy: 'user@example.com',
    SubmittedOn: '2026-03-15T10:30:00Z',
    Amount: 500000,
    Priority: 'Medium',
    Requirements: 'Detailed requirements would be specified here.',
    Conditions: 'Specific conditions and contingencies apply.',
    UpdatedAt: '2026-03-15T10:30:00Z',
    CurrentStage: 'Pending Review',
    ReviewHistory: [
      {
        Reviewer: 'system',
        Action: 'submitted',
        Timestamp: '2026-03-15T10:30:00Z',
        Comments: 'Approval request submitted for review'
      }
    ]
  };
  
  return mockDetail;
};