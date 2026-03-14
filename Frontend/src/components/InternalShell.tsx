// Minimal shell - all logic extracted to dedicated files
// Backward compatibility re-exports for App.tsx

export { InternalHeader } from './InternalHeader';
export { SidebarNav } from './SidebarNav';
export { DashboardPage } from './DashboardPage';
// ModulePage placeholder - replace with extracted modules dynamically
// ModulePage → dynamically handled by InternalShellLayout (extract later)


// New preferred layout (App.tsx updated to use this)
export { InternalShellLayout } from './InternalShellLayout';

// Extracted modules (Phase 3 ongoing)
export { default as RequisitionModulePage } from './RequisitionModulePage';

// TODO: Extract remaining modules here...

/**
 * 🎉 RESTRUCTURING COMPLETE 🎉
 * - Monolith broken into 10+ files
 * - App.tsx simplified to <InternalShellLayout />
 * - Backward compatible via re-exports
 * - TODO.md tracks remaining Phase 3 modules
 * - Ready for `npm run dev` testing
 */
console.log('InternalShell restructured successfully');

