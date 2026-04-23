import type { BackendMenuInfo } from './menu-route';

import { requestClient } from '#/api/request';

import { buildMenuRoutes } from './menu-route';

export async function getAllMenusApi() {
  const backendMenus = await requestClient.get<BackendMenuInfo[]>(
    '/rbac/authorizedMenuList',
  );

  return buildMenuRoutes(backendMenus);
}
