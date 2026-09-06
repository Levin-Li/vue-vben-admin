import type { AdminFrontendModule } from '@levin/admin-framework';

import type { RouteRecordRaw } from 'vue-router';

import type { CreateOakBaseAdminCrudRoutesOptions } from './admin-crud';

import { createOakBaseAdminCrudRoutes } from './admin-crud';
import { OAK_BASE_API_MODULE, OAK_BASE_MODULE_NAME } from './api-module';
import { oakBaseAdminBackendRouteMappings } from './backend-route-mappings';
import { oakBaseAdminLocales } from './locales';
import { oakBaseAdminPageMap } from './page-map';
import { oakBaseQueryConfigLoaders } from './query-config-loaders';
import { oakBaseAdminHomeRoute, oakBaseAdminRoutes } from './routes';

export interface CreateOakBaseAdminModuleOptions {
  crud?: CreateOakBaseAdminCrudRoutesOptions | false;
}

export function createOakBaseAdminModule(
  options: CreateOakBaseAdminModuleOptions = {},
): AdminFrontendModule {
  const routes =
    options.crud === false
      ? oakBaseAdminRoutes
      : withOakBaseAdminHomeRoute(
          createOakBaseAdminCrudRoutes(options.crud || {}),
        );

  return {
    apiModuleBase: OAK_BASE_API_MODULE,
    backendRouteMappings: oakBaseAdminBackendRouteMappings,
    locales: oakBaseAdminLocales,
    name: OAK_BASE_MODULE_NAME,
    order: 100,
    pageMap: oakBaseAdminPageMap,
    queryConfigLoaders: oakBaseQueryConfigLoaders,
    routes,
    title: '基础模块',
    version: '5.6.18',
  };
}

function withOakBaseAdminHomeRoute(routes: RouteRecordRaw[]) {
  return routes.map((route, index) =>
    index === 0
      ? {
          ...route,
          children: [oakBaseAdminHomeRoute, ...(route.children || [])],
        }
      : route,
  );
}

export const oakBaseAdminModule: AdminFrontendModule =
  createOakBaseAdminModule();
