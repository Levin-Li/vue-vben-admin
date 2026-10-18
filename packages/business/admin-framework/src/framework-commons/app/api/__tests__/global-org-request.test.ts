import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCrudList } from '../../../api';
import {
  configureDataAttrPolicyLoader,
  suspendDataAttrPolicies,
} from '../../../data-attr-policy';
import {
  setCurrentGlobalUserOrgRecord,
  setCurrentGlobalUserOrgRecords,
  setGlobalUserOrgContextEnabled,
} from '../../global-org-context-state';
import { baseRequestClient, requestClient } from '../request';

const mocks = vi.hoisted(() => ({
  token: 'token',
  user: { superAdmin: false },
  get: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock('@vben/runtime/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/api' }),
}));
vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: { app: {} },
}));
vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => ({ accessToken: mocks.token }),
  useUserStore: () => ({ userInfo: mocks.user }),
}));
vi.mock('@vben/runtime/request', async () => ({
  ...(await vi.importActual('@vben/runtime/request')),
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
    mocks.token = 'token';
    setGlobalUserOrgContextEnabled(true);
    mocks.user.superAdmin = false;
    mocks.get.mockClear();
    setCurrentGlobalUserOrgRecord({
      id: 'u',
      kind: 'user',
      name: '用户',
      orgId: 'o',
    });
  });

  it('登录页已签发令牌后只对匿名接口清除请求头', async () => {
    window.history.replaceState({}, '', '/auth/login');
    mocks.token = 'issued-token';
    try {
      const userInfo = await intercept({ url: '/Rbac/userInfo', headers: {} });
      expect(userInfo.headers.Authorization).toBe('issued-token');

      const challenge = await intercept({
        url: '/Rbac/loginVerifyChallenge',
        headers: { Authorization: 'old-token' },
      });
      expect(challenge.headers.Authorization).toBeUndefined();
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('仅按所选组织或用户的唯一所属租户注入租户 Header', async () => {
    setCurrentGlobalUserOrgRecord({
      id: 'org-a',
      kind: 'org',
      name: '组织A',
      tenantId: 'tenant-a',
    });
    const selected = await intercept({ headers: {} });
    expect(selected.headers).toMatchObject({
      'X-Oak-Tenant-Id': 'tenant-a',
    });

    setCurrentGlobalUserOrgRecords([], false);
    const cleared = await intercept({ headers: {} });
    expect(cleared.headers['X-Oak-Tenant-Id']).toBeUndefined();

    setCurrentGlobalUserOrgRecords(
      [
        { id: 'org-a', kind: 'org', name: '组织A', tenantId: 'tenant-a' },
        { id: 'org-b', kind: 'org', name: '组织B', tenantId: 'tenant-b' },
      ],
      true,
    );
    const mixed = await intercept({ headers: {} });
    expect(mixed.headers['X-Oak-Tenant-Id']).toBeUndefined();
  });

  it('选择租户节点时只注入租户 Header', async () => {
    setCurrentGlobalUserOrgRecord({
      id: 'tenant-a',
      kind: 'tenant',
      name: '租户A',
      tenantId: 'tenant-a',
    });

    const result = await intercept({ headers: {} });

    expect(result.headers).toMatchObject({
      'X-Oak-Tenant-Id': 'tenant-a',
    });
    expect(result.headers['X-Oak-Org-Id']).toBeUndefined();
    expect(result.headers['X-Oak-Owner-Id']).toBeUndefined();
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

  it('条件配置不再进入或改写 URL 参数', async () => {
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
    expect(adminResult.params).toEqual({ ownerId: 'old' });
    expect(adminResult.headers).toMatchObject({
      'X-Oak-Org-Id': 'o',
      'X-Oak-Owner-Id': 'u',
    });
  });

  it('多选组织使用逗号分隔 Header，且不发送单选 Header', async () => {
    setCurrentGlobalUserOrgRecords(
      [
        { id: 'org-a', kind: 'org', name: '组织A' },
        { id: 'org-b', kind: 'org', name: '组织B' },
      ],
      true,
    );

    const result = await intercept({ headers: {} });

    expect(result.headers).toMatchObject({
      'X-Oak-Org-Id-List': 'org-a,org-b',
    });
    expect(result.headers['X-Oak-Org-Id']).toBeUndefined();
  });

  it('多选用户使用与组织一致的逗号分隔 Header，且不发送单选 Header', async () => {
    setCurrentGlobalUserOrgRecords(
      [
        { id: 'user-a', kind: 'user', name: '用户A', orgId: 'org-a' },
        { id: 'user-b', kind: 'user', name: '用户B', orgId: 'org-b' },
      ],
      true,
    );

    const result = await intercept({ headers: {} });

    expect(result.headers).toMatchObject({
      'X-Oak-Owner-Id-List': 'user-a,user-b',
    });
    expect(result.headers['X-Oak-Owner-Id']).toBeUndefined();
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
    const baseResult = await (
      baseRequestClient as any
    ).interceptors[0].fulfilled({
      headers: {},
      params,
    });
    expect(baseResult.params).toBe(params);
  });

  it('关闭后即使有迟到选中值也不补参数，显式值和 body 保留', async () => {
    setGlobalUserOrgContextEnabled(false);
    setCurrentGlobalUserOrgRecord({
      id: 'old',
      kind: 'org',
      name: '旧组织',
      orgId: 'old',
    });
    const params = { orgId: 'explicit', tenantId: 'manual' };
    const data = { orgIdList: ['form'], ownerId: 'form-owner' };
    const result = await intercept({
      headers: {},
      params,
      data,
      __globalUserOrgContext: { isOverride: true },
    });
    expect(result.params).toBe(params);
    expect(result.data).toBe(data);
    const empty = await intercept({ headers: {}, params: { pageIndex: 1 } });
    expect(empty.params).toEqual({ pageIndex: 1 });
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

describe('公开登录目录精确边界', () => {
  const secure = (config: any) =>
    (baseRequestClient as any).interceptors[0].fulfilled(config);

  it('暂停时只允许GET公开目录，其他方法和相邻路径继续拒绝', async () => {
    const policy = vi.fn();
    configureDataAttrPolicyLoader(policy);
    suspendDataAttrPolicies();
    const config = {
      method: 'GET',
      url: '/oauth/getSupportedPlatforms',
      baseURL: '',
      headers: {},
    };
    await expect(secure(config)).resolves.toMatchObject(config);
    await expect(
      secure({ ...config, url: '/oauth/getSupportedPlatforms?tenantId=qa' }),
    ).resolves.toHaveProperty(
      'url',
      '/oauth/getSupportedPlatforms?tenantId=qa',
    );
    for (const [method, url] of [
      ['POST', '/oauth/getSupportedPlatforms'],
      ['GET', '/oauth/getSupportedPlatforms/extra'],
      ['GET', '/oauth/bindings'],
      ['GET', '/other?next=/oauth/getSupportedPlatforms'],
    ]) {
      await expect(secure({ ...config, method, url })).rejects.toThrow(
        '登录会话尚未就绪',
      );
    }
    expect(policy).not.toHaveBeenCalled();
  });
});
