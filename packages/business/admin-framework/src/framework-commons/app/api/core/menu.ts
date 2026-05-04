import type { RouteRecordStringComponent } from '@vben/types';

import { collectAdminModuleBackendRouteMappings } from '@levin/admin-framework';

import type { BackendMenuInfo } from './menu-route';

import { requestClient } from '@levin/admin-framework/framework-commons/app/api/request';
import { getEnabledFrontendModules } from '@levin/admin-framework/framework-commons/app/options';

import { buildMenuRoutes } from './menu-route';

const MY_MESSAGES_ROUTE: RouteRecordStringComponent = {
  component: '/system/com_levin_oak_base/my-messages/index.vue',
  meta: {
    hideInMenu: true,
    icon: 'lucide:bell',
    title: '我的消息',
  },
  name: 'MyMessagesPage',
  path: '/clob/V1/MyMessages',
};

function createMyMessagesRoute(): RouteRecordStringComponent {
  return {
    component: MY_MESSAGES_ROUTE.component,
    meta: {
      hideInMenu: true,
      icon: 'lucide:bell',
      title: '我的消息',
    },
    name: MY_MESSAGES_ROUTE.name,
    path: MY_MESSAGES_ROUTE.path,
  };
}

function hasRoutePath(
  routes: RouteRecordStringComponent[],
  path: string,
): boolean {
  return routes.some((route) => {
    if (route.path === path) {
      return true;
    }

    return route.children ? hasRoutePath(route.children, path) : false;
  });
}

export async function getAllMenusApi() {
  const backendMenus = await getAuthorizedMenuListApi();
  const routes = buildMenuRoutes(
    backendMenus,
    collectAdminModuleBackendRouteMappings(getEnabledFrontendModules()),
  );

  if (!hasRoutePath(routes, MY_MESSAGES_ROUTE.path)) {
    routes.push(createMyMessagesRoute());
  }

  return routes;
}

export async function getAuthorizedMenuListApi() {
  return requestClient.get<BackendMenuInfo[]>('/rbac/authorizedMenuList', {
    params: {
      loadAll: true,
    },
  });
}
