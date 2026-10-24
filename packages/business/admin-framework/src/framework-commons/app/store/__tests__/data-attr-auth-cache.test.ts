import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  registerDataAttrStaticContract,
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
  currentUser: undefined as any,
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
  useUserStore: () => ({
    get userInfo() {
      return mocks.currentUser;
    },
    setUserInfo: mocks.setUserInfo,
  }),
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
  mocks.currentUser = { fieldGroupGrants: { version: 1, allowed: [] } };
  mocks.userInfo.mockReset();
  mocks.setUserInfo.mockReset();
  mocks.access.mockReset().mockResolvedValue(mocks.codes);
  mocks.policy.mockReset();
  registerDataAttrStaticContract({
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
    expect(mocks.policy).not.toHaveBeenCalled();
    expect(mocks.access).not.toHaveBeenCalled();
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
    expect(mocks.policy).not.toHaveBeenCalled();
  });

  it('并发路由共享一次初始化，目录在登录许可就绪后加载', async () => {
    const load = vi.fn(async () => {
      expect(isDataAttrPolicyReady()).toBe(true);
      expect(mocks.access).toHaveBeenCalledTimes(1);
      expect(mocks.policy).not.toHaveBeenCalled();
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
      expect(mocks.policy).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it('登录响应许可按身份合并，旧服务器和超管标记不会保留上一用户许可', async () => {
    registerDataAttrStaticContract({
      version: 1,
      policies: [
        {
          id: 'controlled',
          operation: 'contract:read',
          methods: ['GET'],
          pathPatterns: ['/contract'],
          restricted: true,
          groups: [{ id: 'finance', name: '财务', authorizable: true }],
          nodes: {},
          requestRoots: [],
          responseRoot: null,
          viewRoots: { request: [], response: [] },
        },
      ],
    });
    mocks.currentUser = {
      fieldGroupGrants: {
        version: 1,
        allowed: [{ operation: 'contract:read', groupKeys: ['finance'] }],
      },
    };
    const auth = useAuthStore();
    await auth.ensureAccessCodesLoaded();
    expect(
      (await loadDataAttrPolicy('GET', '/contract'))!.groups[0]!.allowed,
    ).toBe(true);
    mocks.token = 'legacy-token';
    mocks.currentUser = { isSuperAdmin: true };
    await auth.ensureAccessCodesLoaded();
    expect(
      (await loadDataAttrPolicy('GET', '/contract'))!.groups[0]!.allowed,
    ).toBe(false);
    expect(mocks.policy).not.toHaveBeenCalled();
  });

  it('旧服务器没有字段许可时使用空许可且不补发策略请求', async () => {
    mocks.currentUser = { id: 'legacy-user' };
    await useAuthStore().ensureAccessCodesLoaded();
    expect(isDataAttrPolicyReady()).toBe(true);
    await expect(loadDataAttrPolicy('GET', '/plain')).resolves.toMatchObject({
      restricted: false,
    });
    expect(mocks.policy).not.toHaveBeenCalled();
  });

  it('切换身份后本地许可重新初始化且不请求策略接口', async () => {
    const auth = useAuthStore();
    await auth.ensureAccessCodesLoaded();
    const epoch = getDataAttrPolicyEpoch();
    mocks.token = 'next-token';
    mocks.currentUser = { fieldGroupGrants: { version: 1, allowed: [] } };
    await auth.ensureAccessCodesLoaded();
    expect(getDataAttrPolicyEpoch()).toBeGreaterThan(epoch);
    expect(isDataAttrPolicyReady()).toBe(true);
    expect(mocks.policy).not.toHaveBeenCalled();
  });
});
