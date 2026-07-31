'use client';

import React from 'react';
import type { InternalModule, RoleKey } from '../types/internal';
import { NeedsCollectionModule } from './NeedsCollectionModule';

interface NeedsAndRequisitionsModuleProps {
  module: InternalModule;
  token: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds?: string[];
  onModuleChange?: (moduleId: string) => void;
}

export const NeedsAndRequisitionsModule: React.FC<NeedsAndRequisitionsModuleProps> = ({
  module,
  token,
  role,
}) => {
  if (!token) return null;
  return <NeedsCollectionModule module={module} token={token} role={role} />;
};
