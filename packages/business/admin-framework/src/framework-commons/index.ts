import type { App, Component } from 'vue';
import type { Pinia } from 'pinia';
import type { RouteRecordRaw, Router } from 'vue-router';
import type { AdminPageMap } from './page-registry';

export * from './api';
export * from './api-authorize';
export * from './app/options';
export * from './event-bus';
export * from './page-map';
export * from './page-registry';
export * from './rbac-access';
export * from './request-service';
/**
 * Browser-window draggable floating panels.
 *
 * Business modules should register floating content through
 * `useDraggableFloatingPanels(scope)` or `addDraggableFloatingPanel(item)`.
 * The framework root app owns the global `DraggableFloatingPanelHost`; normal
 * pages should not mount another host unless they intentionally need a local
 * scoped floating area.
 */
export * from './shared/draggable-floating-panel-service';
/**
 * Dynamic top header extension areas.
 *
 * Use `useLayoutHeaderExtensionArea('center')` for top-center controls and
 * `useLayoutHeaderExtensionArea('right')` for compact controls near the global
 * toolbar. Use stable ids and `order`; component-scoped registrations are
 * cleaned up automatically on unmount.
 */
export {
  addLayoutHeaderExtensionAreaItem,
  clearLayoutHeaderExtensionArea,
  getLayoutHeaderExtensionAreaItems,
  removeLayoutHeaderExtensionAreaItem,
  useLayoutHeaderExtensionArea,
  type LayoutHeaderExtensionAreaItem,
  type LayoutHeaderExtensionAreaName,
} from '@vben/layouts';
export { default as RbacPermissionMatchUtils } from './rbac-permission-match';
export * from './runtime';
export { default as DraggableFloatingPanelHost } from './shared/draggable-floating-panel-host.vue';
export { default as DraggableFloatingPanel } from './shared/draggable-floating-panel.vue';

export interface AdminMenuItem {
  badge?: string | number;
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
  getUser?: () => Promise<UserInfo | null> | UserInfo | null;
  hasPermission?: (permission: string | string[]) => boolean;
  pinia: Pinia;
  request: RequestClient;
  router: Router;
}

export type AdminLocaleMessages = Record<string, unknown>;
export type AdminLocaleMessagesMap = Record<string, AdminLocaleMessages>;

export interface AdminBackendRouteMapping {
  icon: string;
  name: string;
  path: string;
  resource: string;
  sourceFilePath?: string;
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
    .sort((left, right) => (left.order || 0) - (right.order || 0));
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function mergeLocaleMessages(
  target: AdminLocaleMessages,
  source: AdminLocaleMessages,
) {
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = target[key];
    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      target[key] = mergeLocaleMessages({ ...targetValue }, sourceValue);
      continue;
    }
    target[key] = sourceValue;
  }
  return target;
}

export function collectAdminModuleLocales(
  modules: AdminFrontendModule[],
): AdminLocaleMessagesMap {
  const locales: AdminLocaleMessagesMap = {};

  for (const module of modules) {
    for (const [locale, messages] of Object.entries(module.locales || {})) {
      locales[locale] = mergeLocaleMessages(
        { ...(locales[locale] || {}) },
        messages,
      );
    }
  }

  return locales;
}

export async function setupAdminModules<RequestClient, UserInfo>(
  modules: AdminFrontendModule<RequestClient, UserInfo>[],
  context: AdminModuleContext<RequestClient, UserInfo>,
) {
  for (const module of modules) {
    await module.setup?.(context);
  }
}
