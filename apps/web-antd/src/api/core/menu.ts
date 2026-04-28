import type { BackendMenuInfo } from './menu-route';

import { requestClient } from '#/api/request';

import { buildMenuRoutes } from './menu-route';

export async function getAllMenusApi() {
  const backendMenus = await getAuthorizedMenuListApi();

  return buildMenuRoutes(backendMenus);
}

export async function getAuthorizedMenuListApi() {
  return requestClient.get<BackendMenuInfo[]>('/rbac/authorizedMenuList');
}
