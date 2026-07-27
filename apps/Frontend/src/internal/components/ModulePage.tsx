import React from 'react';
import type { InternalModule } from '../types/internal';

interface ModulePageProps {
  module: InternalModule;
  moduleData: unknown;
  moduleError: string | null;
  isLoading: boolean;
  token?: string | null;
  role?: string | null;
  userEmail?: string | null;
}

const ModulePage: React.FC<ModulePageProps> = ({
  module,
  moduleData,
  moduleError,
  isLoading,
  token,
  role,
  userEmail
}) => {
  if (isLoading) {
    return <div className="plan-loading">Loading module...</div>;
  }

  if (moduleError) {
    return <div className="portal-alert">{moduleError}</div>;
  }

  // Dynamic module rendering placeholder
  // In production: switch(module.id) or dynamic imports
  const ModuleComponent = React.lazy(() => import(`./${module.id.replace(/-/g, '')}`));

  return (
    <React.Suspense fallback={<div>Loading module component...</div>}>
      <ModuleComponent 
        module={module}
        moduleData={moduleData}
        token={token}
        role={role}
        userEmail={userEmail}
      />
    </React.Suspense>
  );
};

export default ModulePage;

