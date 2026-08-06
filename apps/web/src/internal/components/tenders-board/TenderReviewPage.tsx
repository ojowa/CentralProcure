'use client';

import type { InternalModule, RoleKey } from '../../types/internal';
import { TendersBoardWorkspacePage } from './TendersBoardWorkspacePage';

interface Props {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds?: string[];
  onModuleChange?: (moduleId: string) => void;
  initialData?: unknown;
}

export const TenderReviewPage = (props: Props) => (
  <TendersBoardWorkspacePage
    module={props.module}
    token={props.token}
    role={props.role}
    userEmail={props.userEmail}
    availableModuleIds={props.availableModuleIds}
    onModuleChange={props.onModuleChange}
    initialData={props.initialData}
    mode="review"
  />
);
