import { clearLastVisitedPath } from '../router/routes/root-redirect';

interface UserAccessSessionStore {
  setAccessCodes(codes: []): void;
  setAccessMenus(menus: []): void;
  setAccessRoutes(routes: []): void;
  setIsAccessChecked(isAccessChecked: boolean): void;
}

export function clearPreviousUserAccessState(
  accessStore: UserAccessSessionStore,
  resetRoutes: () => void,
  resetNavigationState?: () => void,
) {
  // 清理上一账号的授权结果，禁止下一个账号复用菜单或权限码。
  accessStore.setAccessCodes([]);
  accessStore.setAccessMenus([]);
  accessStore.setAccessRoutes([]);
  accessStore.setIsAccessChecked(false);

  // 移除已注册的动态路由，并清空仅属于当前会话的页面导航状态。
  resetRoutes();
  clearLastVisitedPath();
  resetNavigationState?.();
}
