import { createMemoryHistory, createRouter } from 'vue-router';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../store/auth';
import { createRouterGuard } from '../guard';
import { resolveRestorablePath } from '../routes/root-redirect';

const state = vi.hoisted(() => ({
  router: undefined as ReturnType<typeof createRouter> | undefined,
  accessToken: '',
  isAccessChecked: false,
  userInfo: null as null | { homePath: string; roles: string[] },
}));
vi.mock('vue-router', async () => ({
  ...(await vi.importActual('vue-router')),
  useRouter: () => state.router,
}));
vi.mock('../../router', () => ({ resetRoutes: vi.fn() }));
const api = vi.hoisted(() => ({
  logout: vi.fn(),
  complete: vi.fn(),
}));
vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  logoutApi: api.logout,
  completePasswordLoginApi: api.complete,
  loginApi: vi.fn(),
  getUserInfoApi: async () => ({ roles: [], homePath: '/index' }),
  getAccessCodesApi: async () => [],
}));
vi.mock('@levin/admin-framework/framework-commons/app/locales', () => ({
  $t: (key: string) => key,
}));
vi.mock('ant-design-vue', () => ({ notification: { success: vi.fn() } }));
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
  resetAllStores: () => {
    state.accessToken = '';
  },
  useAccessStore: () => ({
    setAccessToken: (value: string) => {
      state.accessToken = value;
    },
    accessCodes: [],
    setAccessCodes: vi.fn(),
    setLoginExpired: vi.fn(),
    loginExpired: false,
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
vi.mock('@levin/admin-framework/framework-commons/app/store', async () => {
  const store = await import('../../store/auth');
  return { useAuthStore: store.useAuthStore };
});
vi.mock(
  '@levin/admin-framework/framework-commons/app/store/user-access-session',
  () => ({
    clearPreviousUserAccessState: (
      _access: unknown,
      _reset: unknown,
      _tabs: unknown,
      options?: { clearCredentials?: boolean },
    ) => {
      state.isAccessChecked = false;
      if (options?.clearCredentials !== false) state.accessToken = '';
    },
  }),
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
  state.router = router;
  createRouterGuard(router, vi.fn());
  return router;
}

describe('工作流邮件链接普通登录回跳', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.logout.mockReset().mockResolvedValue(undefined);
    api.complete
      .mockReset()
      .mockResolvedValue({ accessToken: 'current-login-token' });
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
      await useAuthStore().authLoginWithPasswordChallenge({
        loginVerifyChallengeId: 'current-challenge',
        verifyCode: '123456',
      });
      expect(api.complete).toHaveBeenCalledWith({
        loginVerifyChallengeId: 'current-challenge',
        verifyCode: '123456',
      });
      expect(router.currentRoute.value.fullPath).toBe(expected);
      expect(router.currentRoute.value.query[key]).toBe(value);
      expect(state.isAccessChecked).toBe(true);
    },
  );

  it('deduplicates expired responses and preserves the original task across login-page logout', async () => {
    const router = buildRouter();
    const target = '/clob/V1/MyWorkflow?taskId=task%2B1#operation';
    state.accessToken = 'old-token';
    state.isAccessChecked = true;
    router.addRoute({
      name: 'Task',
      path: '/clob/V1/MyWorkflow',
      component: { template: '<div />' },
    });
    await router.push(target);
    // The request auth-failure handler already revoked the expired token.
    state.accessToken = '';
    await Promise.all([
      useAuthStore().logout(),
      useAuthStore().logout(),
      useAuthStore().logout(),
    ]);
    expect(api.logout).not.toHaveBeenCalled();
    expect(router.currentRoute.value.query.redirect).toBe(target);
    expect(router.currentRoute.value.fullPath).not.toContain('%252F');
    await useAuthStore().logout();
    expect(router.currentRoute.value.query.redirect).toBe(target);
    await useAuthStore().authLoginWithPasswordChallenge({
      loginVerifyChallengeId: 'current-challenge',
    });
    expect(router.currentRoute.value.fullPath).toBe(target);
    expect(router.currentRoute.value.query.taskId).toBe('task+1');
  });

  it('cleans the session and redirects even when normal logout fails', async () => {
    const router = buildRouter();
    state.accessToken = 'old-token';
    state.isAccessChecked = true;
    await router.push('/index');
    api.logout.mockRejectedValue(new Error('endpoint unavailable'));
    await Promise.all([useAuthStore().logout(), useAuthStore().logout()]);
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(state.accessToken).toBe('');
    expect(state.userInfo).toBeNull();
    expect(state.isAccessChecked).toBe(false);
    expect(router.currentRoute.value.path).toBe('/auth/login');
    expect(router.currentRoute.value.query.redirect).toBe('/index');
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/auth/login?redirect=/index',
  ])('rejects unsafe login return %s', async (redirect) => {
    const router = buildRouter();
    await router.push({ path: '/auth/login', query: { redirect } });
    await useAuthStore().logout();
    expect(router.currentRoute.value.query).toEqual({});
    await useAuthStore().authLoginWithPasswordChallenge({
      loginVerifyChallengeId: 'current-challenge',
    });
    expect(router.currentRoute.value.path).toBe('/index');
  });

  it('finishes normal logout when its endpoint invokes the auth-failure callback', async () => {
    const router = buildRouter();
    state.accessToken = 'old-token';
    state.isAccessChecked = true;
    await router.push('/index');
    api.logout.mockImplementation(async () => {
      state.accessToken = '';
      await useAuthStore().logout(true, false);
      throw new Error('401');
    });
    await useAuthStore().logout();
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(state.accessToken).toBe('');
    expect(router.currentRoute.value.path).toBe('/auth/login');
    expect(router.currentRoute.value.query.redirect).toBe('/index');
  });

  it('回跳拒绝外站或协议相对地址', () => {
    expect(resolveRestorablePath('https://evil.example')).toBe('/index');
    expect(resolveRestorablePath('//evil.example/operation')).toBe('/index');
  });
});
