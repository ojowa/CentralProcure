'use client';

import { useWorkspace } from './InternalWorkspaceContext';
import { moduleRenderers, renderGenericModuleWorkspace } from './InternalModuleRenderers';

export const InternalModuleView = () => {
  const {
    activeModule,
    activeModuleId,
    moduleData,
    moduleError,
    isModuleLoading,
    selectedRole,
    token,
    userEmail,
    availableModuleIds,
    handleModuleChange
  } = useWorkspace();

  if (!activeModuleId || activeModuleId === 'dashboard' || !activeModule) {
    return (
      <section className="portal-module">
        <div className="portal-alert">Module could not be resolved.</div>
      </section>
    );
  }

  const activeModuleRenderer = moduleRenderers[activeModule.id] ?? null;

  return (
    (activeModuleRenderer ?? renderGenericModuleWorkspace)({
      module: activeModule,
      moduleData,
      moduleError,
      isLoading: isModuleLoading,
      token,
      role: selectedRole,
      userEmail,
      availableModuleIds,
      onModuleChange: handleModuleChange
    })
  );
};