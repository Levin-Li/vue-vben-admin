import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDataAttrPolicyEpoch,
  guardDataAttrRequest,
  isDataAttrPolicyReady,
  loadDataAttrPolicy,
  suspendDataAttrPolicies,
} from '../../../data-attr-policy';
import { useAuthStore } from '../auth';

const mocks = vi.hoisted(() => ({
  codes: ['domain:type:resource:action'],
  access: vi.fn(),
  policy: vi.fn(),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({}) }));
vi.mock('@vben/runtime/constants', () => ({ LOGIN_PATH: '/auth/login' }));
vi.mock('@vben/runtime/stores', () => ({
  resetAllStores: vi.fn(),
  useAccessStore: () => ({
    get accessCodes() {
      return mocks.codes;
    },
    setAccessCodes: (codes: string[]) => {
      mocks.codes = codes;
    },
  }),
  useTabbarStore: () => ({}),
  useUserStore: () => ({}),
}));
vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: { app: {} },
}));
vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  completePasswordLoginApi: vi.fn(),
  getAccessCodesApi: mocks.access,
  getUserInfoApi: vi.fn(),
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
}));
vi.mock('@levin/admin-framework/framework-commons/app/locales', () => ({
  $t: (value: string) => value,
}));
vi.mock('ant-design-vue', () => ({ notification: {} }));
vi.mock('../../api/data-attr-policy-service', () => ({
  dataAttrPolicyService: { resolve: mocks.policy },
}));

beforeEach(() => {
  setActivePinia(createPinia());
  suspendDataAttrPolicies();
  mocks.codes = ['domain:type:resource:action'];
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
});
