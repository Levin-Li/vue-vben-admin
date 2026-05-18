import type { RouteRecordStringComponent } from '@vben/types';

import { collectAdminModuleBackendRouteMappings } from '@levin/admin-framework';

import { getEnabledFrontendModules } from '@levin/admin-framework/framework-commons/app/options';

import { buildMenuRoutes } from './menu-route';
import { rbacService } from '../rbac-service';

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

/**
 * 获取前端菜单路由。
 * 后端菜单数据来自 RbacService。
 */
export async function getAllMenusApi() {
  const backendMenus = await rbacService.getAuthorizedMenuList({
    loadAll: false,
  });
  const routes = buildMenuRoutes(
    backendMenus,
    collectAdminModuleBackendRouteMappings(getEnabledFrontendModules()),
  );

  if (!hasRoutePath(routes, MY_MESSAGES_ROUTE.path)) {
    routes.push(createMyMessagesRoute());
  }

  return routes;
}
