import type { AdminFrontendModule } from '@levin/admin-framework';

import { createOakBaseAdminModule } from '@levin/oak-base-admin';

export const enabledFrontendModules: AdminFrontendModule[] = [
  createOakBaseAdminModule(),
];
