import { watch } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  configureDataAttrPolicyLoader,
  getDataAttrPolicyEpoch,
  guardDataAttrRequest,
  isDataAttrPolicyReady,
  loadDataAttrPolicy,
  suspendDataAttrPolicies,
} from '../../../data-attr-policy';
import {
  clearAdminSession,
  registerAdminSessionInitializer,
} from '../../session-resources';
import { useAuthStore } from '../auth';

const mocks = vi.hoisted(() => ({
  codes: ['domain:type:resource:action'],
  token: 'current-token',
  access: vi.fn(),
  policy: vi.fn(),
  userInfo: vi.fn(),
  setUserInfo: vi.fn(),
}));
vi.mock('../../api/session-role-options', () => ({}));
vi.mock('vue-router', () => ({ useRouter: () => ({}) }));
vi.mock('@vben/runtime/constants', () => ({ LOGIN_PATH: '/auth/login' }));
vi.mock('@vben/runtime/stores', () => ({
  resetAllStores: vi.fn(),
  useAccessStore: () => ({
    get accessToken() {
      return mocks.token;
    },
    get accessCodes() {
      return mocks.codes;
    },
    setAccessCodes: (codes: string[]) => {
      mocks.codes = codes;
    },
  }),
  useTabbarStore: () => ({}),
  useUserStore: () => ({ setUserInfo: mocks.setUserInfo }),
}));
vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: { app: {} },
}));
vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  completePasswordLoginApi: vi.fn(),
  getAccessCodesApi: mocks.access,
  getUserInfoApi: mocks.userInfo,
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
}));
vi.mock('@levin/admin-framework/framework-commons/app/locales', () => ({
  $t: (value: string) => value,
}));
vi.mock('ant-design-vue', () => ({ notification: {} }));
vi.mock('../../api/data-attr-policy-service', () => ({
  dataAttrPolicyService: { snapshot: mocks.policy },
}));

beforeEach(() => {
  setActivePinia(createPinia());
  suspendDataAttrPolicies();
  clearAdminSession();
  mocks.codes = ['domain:type:resource:action'];
  mocks.token = 'current-token';
  mocks.userInfo.mockReset();
  mocks.setUserInfo.mockReset();
  mocks.access.mockReset().mockResolvedValue(mocks.codes);
  mocks.policy.mockReset().mockResolvedValue({
    version: 1,
    policies: [
      {
        id: 'plain',
        operation: 'domain:type:resource:action',
        methods: ['GET'],
        pathPatterns: ['/plain'],
        restricted: false,
        groups: [],
        nodes: {},
        requestRoots: [],
        responseRoot: null,
        viewRoots: { request: [], response: [] },
      },
    ],
  });
});

describe('会话属性组缓存', () => {
  it('路由权限缓存命中保留epoch和无组策略，不重复元数据HTTP', async () => {
    const auth = useAuthStore();
    await auth.ensureAccessCodesLoaded();
    await loadDataAttrPolicy('GET', '/plain');
    const epoch = getDataAttrPolicyEpoch();
    await auth.ensureAccessCodesLoaded();
    await loadDataAttrPolicy('GET', '/plain');
    expect(getDataAttrPolicyEpoch()).toBe(epoch);
    expect(mocks.policy).toHaveBeenCalledTimes(1);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it('同步就绪监听只读取清理后新代策略，不复用旧账号缓存', async () => {
    const auth = useAuthStore();
    await auth.ensureAccessCodesLoaded();
    await loadDataAttrPolicy('GET', '/plain');
    const epoch = getDataAttrPolicyEpoch();
    let requested: Promise<unknown> | undefined;
    const nextLoader = vi.fn().mockResolvedValue({
      version: 1,
      policies: [
        {
          ...(await loadDataAttrPolicy('GET', '/plain')),
          id: 'next-user-policy',
        },
      ],
    });
    const stop = watch(
      isDataAttrPolicyReady,
      (ready) => {
        if (ready) {
          expect(getDataAttrPolicyEpoch()).toBeGreaterThan(epoch);
          requested = loadDataAttrPolicy('GET', '/plain');
        }
      },
      { flush: 'sync' },
    );
    try {
      configureDataAttrPolicyLoader(nextLoader);
      await expect(requested).resolves.toMatchObject({
        id: 'next-user-policy',
      });
      expect(nextLoader).toHaveBeenCalledTimes(1);
    } finally {
      stop();
    }
  });

  it('旧身份本人信息在切换令牌后迟到不能覆写新会话', async () => {
    let finish!: (user: object) => void;
    mocks.userInfo.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = useAuthStore().fetchUserInfo();
    mocks.token = 'next-token';
    finish({ id: 'old-user' });
    await expect(pending).rejects.toThrow('登录身份已变化');
    expect(mocks.setUserInfo).not.toHaveBeenCalled();
  });

  it('凭据已撤销时权限缓存不能重启策略加载器', async () => {
    mocks.token = '';
    await expect(useAuthStore().ensureAccessCodesLoaded()).rejects.toThrow(
      '登录会话尚未就绪',
    );
    expect(isDataAttrPolicyReady()).toBe(false);
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it('旧身份权限响应晚于令牌撤销时不能重新启用策略', async () => {
    let finish!: (codes: string[]) => void;
    mocks.access.mockReturnValueOnce(
      new Promise<string[]>((resolve) => {
        finish = resolve;
      }),
    );
    const auth = useAuthStore();
    const loading = auth.ensureAccessCodesLoaded(true);
    await vi.waitFor(() => expect(mocks.access).toHaveBeenCalledTimes(1));
    mocks.token = '';
    finish(['old-user:permission']);
    await expect(loading).rejects.toThrow('登录身份已变化');
    expect(isDataAttrPolicyReady()).toBe(false);
    expect(mocks.codes).toEqual(['domain:type:resource:action']);
  });

  it('强制刷新失败时保持暂停，既不读取旧策略也不提交业务请求', async () => {
    const auth = useAuthStore();
    await auth.ensureAccessCodesLoaded();
    await loadDataAttrPolicy('GET', '/plain');
    mocks.access.mockRejectedValueOnce(new Error('权限刷新失败'));
    await expect(auth.ensureAccessCodesLoaded(true)).rejects.toThrow(
      '权限刷新失败',
    );
    expect(isDataAttrPolicyReady()).toBe(false);
    await expect(
      guardDataAttrRequest('PUT', '/contract', { data: { amount: null } }),
    ).rejects.toThrow('会话尚未就绪');
    expect(mocks.policy).toHaveBeenCalledTimes(1);
  });

  it('并发路由共享一次初始化，目录在权限和快照就绪后加载', async () => {
    const load = vi.fn(async () => {
      expect(isDataAttrPolicyReady()).toBe(true);
      expect(mocks.access).toHaveBeenCalledTimes(1);
      expect(mocks.policy).toHaveBeenCalledTimes(1);
    });
    const unregister = registerAdminSessionInitializer('auth-test-directory', {
      load,
      clear: vi.fn(),
    });
    try {
      mocks.codes = [];
      const auth = useAuthStore();
      await Promise.all([
        auth.ensureAccessCodesLoaded(),
        auth.ensureAccessCodesLoaded(),
        auth.ensureAccessCodesLoaded(),
      ]);
      await auth.ensureAccessCodesLoaded();
      expect(load).toHaveBeenCalledTimes(1);
      expect(mocks.access).toHaveBeenCalledTimes(1);
      expect(mocks.policy).toHaveBeenCalledTimes(1);
    } finally {
      unregister();
    }
  });

  it('快照失败不因后续路由再次请求，显式强制刷新可恢复', async () => {
    const auth = useAuthStore();
    mocks.policy.mockRejectedValueOnce(new Error('快照不可用'));
    await expect(auth.ensureAccessCodesLoaded()).rejects.toThrow('快照不可用');
    await expect(auth.ensureAccessCodesLoaded()).rejects.toThrow('快照不可用');
    expect(mocks.policy).toHaveBeenCalledTimes(1);
    expect(isDataAttrPolicyReady()).toBe(false);
    await auth.ensureAccessCodesLoaded(true);
    expect(mocks.policy).toHaveBeenCalledTimes(2);
    expect(isDataAttrPolicyReady()).toBe(true);
  });

  it('旧快照在令牌切换后迟到不能安装，下一身份独立初始化', async () => {
    const response = await mocks.policy();
    mocks.policy.mockClear();
    let finish!: (value: typeof response) => void;
    mocks.policy.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const auth = useAuthStore();
    const old = auth.ensureAccessCodesLoaded();
    await vi.waitFor(() => expect(mocks.policy).toHaveBeenCalledTimes(1));
    mocks.token = 'next-token';
    finish(response);
    await expect(old).rejects.toThrow('登录身份已变化');
    expect(isDataAttrPolicyReady()).toBe(false);
    await auth.ensureAccessCodesLoaded();
    expect(mocks.policy).toHaveBeenCalledTimes(2);
    expect(isDataAttrPolicyReady()).toBe(true);
  });
});
