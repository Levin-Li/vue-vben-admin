import type { Pinia } from 'pinia';

import type { App, Component } from 'vue';
import type { Router, RouteRecordRaw } from 'vue-router';

import type { AdminLocaleMessagesMap } from './locale-utils';
import type { AdminPageMap } from './page-registry';

import { collectAdminModuleLocales as collectModuleLocales } from './locale-utils';

export interface AdminMenuItem {
  badge?: number | string;
  children?: AdminMenuItem[];
  disabled?: boolean;
  icon?: string;
  order?: number;
  path: string;
  permission?: string | string[];
  title: string;
}

export interface AdminModuleContext<
  RequestClient = unknown,
  UserInfo = unknown,
> {
  app: App;
  config?: Record<string, unknown>;
  getUser?: () => null | Promise<null | UserInfo> | UserInfo;
  hasPermission?: (permission: string | string[]) => boolean;
  pinia: Pinia;
  request: RequestClient;
  router: Router;
}

export interface AdminBackendRouteMapping {
  icon: string;
  path: string;
  resource: string;
  sourceFilePath: string;
  title: string;
  viewPath: string;
}

export interface AdminFrontendModule<
  RequestClient = unknown,
  UserInfo = unknown,
> {
  apiModuleBase?: string;
  backendRouteMappings?: AdminBackendRouteMapping[];
  components?: Record<string, Component>;
  locales?: AdminLocaleMessagesMap;
  menus?: AdminMenuItem[];
  name: string;
  order?: number;
  pageMap?: AdminPageMap;
  routes?: RouteRecordRaw[];
  setup?: (
    context: AdminModuleContext<RequestClient, UserInfo>,
  ) => Promise<void> | void;
  title: string;
  version?: string;
}

export function collectAdminModuleRoutes(
  modules: AdminFrontendModule[],
): RouteRecordRaw[] {
  return modules.flatMap((module) => module.routes || []);
}

export function collectAdminModuleMenus(
  modules: AdminFrontendModule[],
): AdminMenuItem[] {
  return modules
    .flatMap((module) => module.menus || [])
    .toSorted((left, right) => (left.order || 0) - (right.order || 0));
}

export function collectAdminModuleBackendRouteMappings(
  modules: AdminFrontendModule[],
): AdminBackendRouteMapping[] {
  return modules.flatMap((module) => module.backendRouteMappings || []);
}

export function collectAdminModulePageMap(
  modules: AdminFrontendModule[],
): AdminPageMap {
  return Object.assign({}, ...modules.map((module) => module.pageMap || {}));
}

export function collectAdminModuleLocales(
  modules: AdminFrontendModule[],
): AdminLocaleMessagesMap {
  return collectModuleLocales(modules);
}

export async function setupAdminModules<RequestClient, UserInfo>(
  modules: AdminFrontendModule<RequestClient, UserInfo>[],
  context: AdminModuleContext<RequestClient, UserInfo>,
) {
  for (const module of modules) {
    await module.setup?.(context);
  }
}
