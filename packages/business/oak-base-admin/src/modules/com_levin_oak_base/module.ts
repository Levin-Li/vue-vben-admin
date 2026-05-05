import type { AdminFrontendModule } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE, OAK_BASE_MODULE_NAME } from './api-module';
import {
  createOakBaseAdminCrudRoutes,
  type CreateOakBaseAdminCrudRoutesOptions,
} from './admin-crud';
import { oakBaseAdminBackendRouteMappings } from './backend-route-mappings';
import { oakBaseAdminLocales } from './locales';
import { oakBaseAdminPageMap } from './page-map';
import { oakBaseAdminRoutes } from './routes';

export interface CreateOakBaseAdminModuleOptions {
  crud?: CreateOakBaseAdminCrudRoutesOptions | false;
}

export function createOakBaseAdminModule(
  options: CreateOakBaseAdminModuleOptions = {},
): AdminFrontendModule {
  return {
    apiModuleBase: OAK_BASE_API_MODULE,
    backendRouteMappings: oakBaseAdminBackendRouteMappings,
    locales: oakBaseAdminLocales,
    name: OAK_BASE_MODULE_NAME,
    order: 100,
    pageMap: oakBaseAdminPageMap,
    routes:
      options.crud === false
        ? oakBaseAdminRoutes
        : createOakBaseAdminCrudRoutes(options.crud || {}),
    title: '基础模块',
    version: '0.9.9',
  };
}

export const oakBaseAdminModule: AdminFrontendModule =
  createOakBaseAdminModule();
