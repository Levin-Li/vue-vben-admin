import type { AdminFrontendModule } from '@levin/admin-framework';

import type { RouteRecordRaw } from 'vue-router';

import type { CreateOakBaseAdminCrudRoutesOptions } from './admin-crud';

import { addLayoutHeaderExtensionAreaItem } from '@levin/admin-framework';

import { packageVersion } from '../../../package-version.mjs';
import { createOakBaseAdminCrudRoutes } from './admin-crud';
import { OAK_BASE_API_MODULE, OAK_BASE_MODULE_NAME } from './api-module';
import { oakBaseAdminBackendRouteMappings } from './backend-route-mappings';
import GlobalPlatformDomainSelector from './global-platform-domain-selector.vue';
import { oakBaseAdminLocales } from './locales';
import { oakBaseAdminPageMap } from './page-map';
import { oakBaseQueryConfigLoaders } from './query-config-loaders';
import {
  aclTestRoute,
  namedScopeVariableAcceptanceRoute,
  oakBaseAdminHomeRoute,
  oakBaseAdminRoutes,
} from './routes';

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
    packageInfo: packageVersion,
    pageMap: oakBaseAdminPageMap,
    queryConfigLoaders: oakBaseQueryConfigLoaders,
    routes,
    setup: () => {
      // 模块初始化不处于 Vue 组件生命周期，使用应用级注册避免错误绑定自动卸载钩子。
      addLayoutHeaderExtensionAreaItem('center', {
        component: GlobalPlatformDomainSelector,
        id: 'global-platform-domain-selector',
        order: 30,
      });
    },
    title: '基础模块',
    version: packageVersion.version,
  };
}

function withOakBaseAdminHomeRoute(routes: RouteRecordRaw[]) {
  return routes.map((route, index) =>
    index === 0
      ? {
          ...route,
          children: [
            oakBaseAdminHomeRoute,
            ...(route.children || []).map((child) =>
              child.meta?.title === '开发&工具'
                ? {
                    ...child,
                    children: [
                      ...(child.children || []),
                      aclTestRoute,
                      namedScopeVariableAcceptanceRoute,
                    ],
                  }
                : child,
            ),
          ],
        }
      : route,
  );
}

export const oakBaseAdminModule: AdminFrontendModule =
  createOakBaseAdminModule();
