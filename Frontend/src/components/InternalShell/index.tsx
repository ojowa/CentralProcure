// Re-export original components for App.tsx backward compatibility
export { InternalHeader } from './InternalHeader';
export { SidebarNav } from './SidebarNav';
export { DashboardPage } from './DashboardPage';
// ModulePage to be extracted later
export { default as ModulePage } from './ModulePage'; // Placeholder until extracted

// New layout (recommended usage)
export { InternalShellLayout } from './InternalShellLayout';

// Individual modules (progressively extracted)
export { default as RequisitionModulePage } from './RequisitionModulePage';

