import { createMemoryHistory, createRouter } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRouterGuard } from '../guard';
import { resolveRestorablePath } from '../routes/root-redirect';

const state = vi.hoisted(() => ({
  accessToken: '',
  isAccessChecked: false,
  userInfo: null as null | { homePath: string; roles: string[] },
}));
vi.mock('@vben/runtime/constants', () => ({ LOGIN_PATH: '/auth/login' }));
vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: {
    app: { defaultHomePath: '/index' },
    transition: { progress: false },
  },
}));
vi.mock('@vben/runtime/utils', () => ({
  startProgress: vi.fn(),
  stopProgress: vi.fn(),
}));
vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => ({
    get accessToken() {
      return state.accessToken;
    },
    get isAccessChecked() {
      return state.isAccessChecked;
    },
    setAccessMenus: vi.fn(),
    setAccessRoutes: vi.fn(),
    setIsAccessChecked: (value: boolean) => {
      state.isAccessChecked = value;
    },
  }),
  useTabbarStore: () => ({ $reset: vi.fn() }),
  useUserStore: () => ({
    get userInfo() {
      return state.userInfo;
    },
    setUserInfo: (value: typeof state.userInfo) => {
      state.userInfo = value;
    },
  }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/app/router/routes',
  async () => {
    const original = await import('../routes/root-redirect');
    return {
      accessRoutes: [],
      coreRouteNames: ['Login'],
      rememberLastVisitedPath: original.rememberLastVisitedPath,
      resolveRestorablePath: original.resolveRestorablePath,
    };
  },
);
vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: () => ({
    ensureAccessCodesLoaded: vi.fn(),
    fetchUserInfo: vi.fn(),
  }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/app/store/user-access-session',
  () => ({ clearPreviousUserAccessState: vi.fn() }),
);
vi.mock('../access', () => ({
  generateAccess: async ({
    router,
  }: {
    router: ReturnType<typeof createRouter>;
  }) => {
    router.addRoute({
      name: '_clob_V1_MyWorkflow',
      path: '/clob/V1/MyWorkflow',
      component: { template: '<div />' },
    });
    return { accessibleMenus: [], accessibleRoutes: [] };
  },
}));

function buildRouter() {
  const component = { template: '<div />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { name: 'Login', path: '/auth/login', component },
      { name: '_index', path: '/index', component },
      { name: 'FallbackNotFound', path: '/:pathMatch(.*)*', component },
    ],
  });
  createRouterGuard(router, vi.fn());
  return router;
}

describe('工作流邮件链接普通登录回跳', () => {
  beforeEach(() => {
    state.accessToken = '';
    state.isAccessChecked = false;
    state.userInfo = null;
  });

  it.each([
    [
      'hash任务链接',
      'https://app.example/#/clob/V1/MyWorkflow?taskId=task%2B1',
      '/clob/V1/MyWorkflow?taskId=task%2B1',
      'taskId',
      'task+1',
    ],
    [
      'history实例链接',
      'https://app.example/clob/V1/MyWorkflow?instanceId=instance-1',
      '/clob/V1/MyWorkflow?instanceId=instance-1',
      'instanceId',
      'instance-1',
    ],
  ])(
    '%s保留定位参数且登录前不访问办理页面',
    async (_label, url, expected, key, value) => {
      const router = buildRouter();
      const mailUrl = new URL(url);
      const entry = mailUrl.hash
        ? mailUrl.hash.slice(1)
        : mailUrl.pathname + mailUrl.search;
      await router.push(entry);
      expect(router.currentRoute.value.path).toBe('/auth/login');
      expect(String(router.currentRoute.value.query.redirect)).toBe(expected);
      state.accessToken = 'current-login-token';
      state.userInfo = { roles: [], homePath: '/index' };
      await router.push('/index');
      expect(router.currentRoute.value.fullPath).toBe(expected);
      expect(router.currentRoute.value.query[key]).toBe(value);
      expect(state.isAccessChecked).toBe(true);
    },
  );

  it('回跳拒绝外站或协议相对地址', () => {
    expect(resolveRestorablePath('https://evil.example')).toBe('/index');
    expect(resolveRestorablePath('//evil.example/operation')).toBe('/index');
  });
});
