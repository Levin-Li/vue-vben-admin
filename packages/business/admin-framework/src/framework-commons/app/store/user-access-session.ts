import { clearLastVisitedPath } from '../router/routes/root-redirect';

interface UserAccessSessionStore {
  setAccessToken(accessToken: null): void;
  setAccessCodes(codes: []): void;
  setAccessMenus(menus: []): void;
  setAccessRoutes(routes: []): void;
  setIsAccessChecked(isAccessChecked: boolean): void;
  setLoginExpired(loginExpired: boolean): void;
  setRefreshToken(refreshToken: null): void;
}

interface ClearPreviousUserAccessStateOptions {
  clearCredentials?: boolean;
}

/**
 * 每次入口应用冷启动都撤销内存中的动态菜单结论，强制首个受保护路由从
 * 服务端重新生成菜单。令牌和权限码仍保留，以便路由守卫能够发起授权请求。
 */
export function resetAccessStateForApplicationStart(
  accessStore: Pick<
    UserAccessSessionStore,
    'setAccessMenus' | 'setAccessRoutes' | 'setIsAccessChecked'
  >,
) {
  accessStore.setAccessMenus([]);
  accessStore.setAccessRoutes([]);
  accessStore.setIsAccessChecked(false);
}

export function clearPreviousUserAccessState(
  accessStore: UserAccessSessionStore,
  resetRoutes: () => void,
  resetNavigationState?: () => void,
  options: ClearPreviousUserAccessStateOptions = {},
) {
  if (options.clearCredentials !== false) {
    // 显式退出或接收新令牌前撤销旧凭据，避免请求携带上一账号身份。
    accessStore.setAccessToken(null);
    accessStore.setRefreshToken(null);
    accessStore.setLoginExpired(false);
  }

  // 清理上一账号的授权结果，禁止下一个账号复用菜单或权限码。
  accessStore.setAccessCodes([]);
  resetAccessStateForApplicationStart(accessStore);

  // 移除已注册的动态路由，并清空仅属于当前会话的页面导航状态。
  resetRoutes();
  clearLastVisitedPath();
  resetNavigationState?.();
}
