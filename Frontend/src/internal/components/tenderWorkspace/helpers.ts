export const canEditTenderFromAuthority = (tender: any, role: string | null, hasPermission?: (key: string) => boolean): boolean => {
  return hasPermission ? hasPermission('tender.manage') : false;
};

export const toTitle = (role: string): string => {
  if (!role) return '';
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};