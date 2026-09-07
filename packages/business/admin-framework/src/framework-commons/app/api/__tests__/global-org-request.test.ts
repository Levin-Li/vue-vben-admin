import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCrudList } from '../../../api';
import { setCurrentGlobalUserOrgRecord } from '../../global-org-context-state';
import { baseRequestClient, requestClient } from '../request';

const mocks = vi.hoisted(() => ({
  user: { superAdmin: false },
  get: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
vi.mock('@vben/preferences', () => ({ preferences: { app: {} } }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessToken: 'token' }),
  useUserStore: () => ({ userInfo: mocks.user }),
}));
vi.mock('@vben/request', () => ({
  RequestClient: class {
    interceptors: any[] = [];
    addRequestInterceptor(value: any) {
      this.interceptors.push(value);
    }
    addResponseInterceptor() {}
  },
  authenticateResponseInterceptor: vi.fn(),
  errorMessageResponseInterceptor: vi.fn(),
}));
vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: vi.fn(),
}));
vi.mock('ant-design-vue', () => ({ message: {} }));
vi.mock('../dynamic-verify-code', () => ({
  createDynamicVerifyCodeInterceptor: vi.fn(),
}));
vi.mock('../request-events', () => ({ emitApiRequestEvent: vi.fn() }));
vi.mock('../../../runtime', () => ({ requestClient: { get: mocks.get } }));

const intercept = (config: any) =>
  (requestClient as any).interceptors[0].fulfilled(config);

describe('全局注入请求配置', () => {
  beforeEach(() => {
    mocks.user.superAdmin = false;
    mocks.get.mockClear();
    setCurrentGlobalUserOrgRecord({
      id: 'u',
      kind: 'user',
      name: '用户',
      orgId: 'o',
    });
  });

  it.each(['get', 'post', 'put', 'delete'])(
    '默认保留 %s 的 URL 参数且不修改 body',
    async (method) => {
      const data = { orgId: 'body' };
      const result = await intercept({
        method,
        headers: {},
        params: { orgId: 'other', orgIdList: ['other'], ownerId: 'old' },
        data,
      });
      expect(result.params).toEqual({
        orgId: 'other',
        orgIdList: ['other'],
        ownerId: 'old',
      });
      expect(result.data).toBe(data);
    },
  );

  it('每次请求读取最新账号状态，条件配置不进入 URL 参数', async () => {
    const config = {
      method: 'get',
      url: '/Demo/list',
      headers: {},
      params: { ownerId: 'old' },
      __globalUserOrgContext: {
        isOverride: "user.superAdmin === true && request.method === 'GET'",
      },
    };
    const ordinaryResult = await intercept({ ...config });
    expect(ordinaryResult.params.ownerId).toBe('old');
    mocks.user.superAdmin = true;
    const adminResult = await intercept({ ...config });
    expect(adminResult.params).toEqual({
      ownerId: 'u',
      orgId: 'o',
      orgIdList: ['o'],
    });
  });

  it('候选查询完全跳过优先于强制覆盖，基础客户端不安装全局注入', async () => {
    const params = { orgId: 'candidate' };
    const result = await intercept({
      headers: {},
      params,
      __skipGlobalUserOrgContext: true,
      __globalUserOrgContext: { isOverride: true },
    });
    expect(result.params).toBe(params);
    expect((baseRequestClient as any).interceptors).toHaveLength(0);
  });

  it('列表 helper 在 config 中传递规则并保持业务参数独立', async () => {
    const rules = { isOverride: true };
    await fetchCrudList('/User/list', { orgId: 'candidate' }, '/module', {
      globalUserOrgContext: rules,
    });
    expect(mocks.get).toHaveBeenCalledWith('/module/User/list', {
      baseURL: '',
      __globalUserOrgContext: rules,
      __skipGlobalUserOrgContext: false,
      params: {
        orgId: 'candidate',
        requireResultList: true,
        requireTotals: true,
      },
    });
  });
});
