export const canEditApprovalFromAuthority = (approval: any, role: string | null): boolean => {
  // Simplified implementation - in reality this would check specific permissions
  return role === 'procurement_officer' || role === 'admin' || role === 'approval_officer';
};

export const toTitle = (role: string): string => {
  if (!role) return '';
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};