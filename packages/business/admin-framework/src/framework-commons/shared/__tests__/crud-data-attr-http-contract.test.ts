import type { DataAttrPolicies } from '../../data-attr-policy';
import type { AdminRequestClient } from '../../runtime';

// @vitest-environment node
import process from 'node:process';

import { effectScope, nextTick, ref } from 'vue';

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ResAuthorize } from '../../api-authorize';
import {
  clearDataAttrPolicies,
  configureDataAttrPolicyLoader,
} from '../../data-attr-policy';
import { requestClient, setAdminFrameworkRuntime } from '../../runtime';
import { useCrudDataAttrAccess } from '../crud-data-attr-access';

const baseUrl = process.env.RBAC_DATA_ATTR_HTTP_URL;
const scopes: ReturnType<typeof effectScope>[] = [];
let actor = 'reader';
const sent: {
  data?: unknown;
  method: string;
  params?: Record<string, unknown>;
  path: string;
}[] = [];

async function rawRequest(
  path: string,
  method = 'GET',
  data?: unknown,
  params?: Record<string, unknown>,
) {
  if (!baseUrl) throw new Error('缺少真实 HTTP 测试服务地址');
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Fixture-User': actor },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const json = await response.json();
  if (!response.ok) {
    const error = Object.assign(
      new Error(json.msg || json.message || `HTTP ${response.status}`),
      { status: response.status, body: json },
    );
    throw error;
  }
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

async function send(
  path: string,
  method: string,
  data?: unknown,
  params?: Record<string, unknown>,
) {
  sent.push({ method, path, data, params });
  return rawRequest(path, method, data, params);
}
const fetchClient: AdminRequestClient = {
  get: <T>(path: string, config: Record<string, any> = {}) =>
    send(path, 'GET', undefined, config.params) as Promise<T>,
  post: <T>(path: string, data?: unknown) =>
    send(path, 'POST', data) as Promise<T>,
  put: <T>(path: string, data?: unknown) =>
    send(path, 'PUT', data) as Promise<T>,
  delete: <T>(path: string, config: Record<string, any> = {}) =>
    send(path, 'DELETE', undefined, config.params) as Promise<T>,
  request: <T>(
    urlOrConfig: Record<string, any> | string,
    config: Record<string, any> = {},
  ) => {
    const options = typeof urlOrConfig === 'string' ? config : urlOrConfig;
    const path =
      typeof urlOrConfig === 'string' ? urlOrConfig : String(options.url || '');
    return send(
      path,
      options.method || 'GET',
      options.data,
      options.params,
    ) as Promise<T>;
  },
};

// 具体路由、角色及状态协议与后端隔离 Spring MVC fixture 保持一致。
const routes = {
  policy: '/com.levin.oak.base/V1/api/rbac/apiDataAttrPolicies',
  update: '/fixture/contracts/update',
  query: '/fixture/contracts/query',
  info: '/fixture/contracts/info',
  state: '/fixture/state',
};
async function callCount(name: 'form' | 'info' | 'plain' | 'query' | 'update') {
  const state = await rawRequest(routes.state);
  return state.calls[name];
}
const identity = ref('reader');
const metadataQueries: unknown[] = [];
function contractAccess() {
  const service = {
    update: (data: unknown) => requestClient.post(routes.update, data),
    list: (data: unknown) => requestClient.post(routes.query, data),
    retrieve: () => requestClient.get(routes.info),
  };
  for (const [methodName, action] of [
    ['update', 'update'],
    ['list', 'query'],
    ['retrieve', 'info'],
  ] as const) {
    ResAuthorize({
      domain: 'fixture',
      type: 'contracts',
      res: 'contract',
      action,
    })(service, methodName, { value: service[methodName] });
  }
  const fields = [
    { key: 'id', label: '标识', form: false },
    { key: 'version', label: '版本', form: false },
    { key: 'optimisticLock', label: '乐观锁', form: false },
    { key: 'title', label: '标题', form: true },
    { key: 'amount', label: '金额', form: true },
  ];
  const config = {
    apiBase: '/fixture/contracts',
    title: '虚构合同',
    fields,
    apiService: service,
    dataAttrConditionKeys: ['version'],
    dataAttrTargets: {
      update: { method: 'POST', path: routes.update },
      list: { method: 'POST', path: routes.query },
      retrieve: { method: 'GET', path: routes.info },
    },
  };
  const scope = effectScope();
  scopes.push(scope);
  const access = scope.run(() =>
    useCrudDataAttrAccess(
      () => config,
      () => routes.query,
      () => identity.value,
    ),
  );
  if (!access) throw new Error('未创建真实 HTTP 字段权限作用域');
  return { access, fields, service };
}
async function useActor(next: string, refresh = true) {
  actor = next;
  identity.value = next;
  if (refresh) clearDataAttrPolicies();
  await nextTick();
}

describe.skipIf(!baseUrl)('真实 Spring MVC 与前端属性组策略契约', () => {
  beforeAll(() => {
    const target = new URL(baseUrl || 'http://127.0.0.1');
    expect(['127.0.0.1', 'localhost', '[::1]']).toContain(target.hostname);
    setAdminFrameworkRuntime({ requestClient: fetchClient });
  });
  beforeEach(async () => {
    actor = 'reader';
    identity.value = 'reader';
    await rawRequest('/fixture/reset', 'POST');
    sent.splice(0);
    metadataQueries.splice(0);
    configureDataAttrPolicyLoader(async (query) => {
      metadataQueries.push(query);
      return (await rawRequest(
        routes.policy,
        'POST',
        query,
      )) as DataAttrPolicies;
    });
  });
  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop();
  });

  it('真实策略裁剪默认值及转换器恢复的赋值，保留ID版本和可写force项', async () => {
    const { access, fields, service } = contractAccess();
    await access.ensure('update');
    const defaults = { id: 'c1', version: 1, optimisticLock: 1, amount: '999.00' };
    const transformed = {
      ...defaults,
      title: '真实HTTP保存',
      amount: null,
      forceUpdateFields: ['amount', 'title'],
    };
    const payload = access.prepareAssignment(
      'update',
      transformed,
      fields.filter((field) => field.form),
    );
    expect(payload).toEqual({
      id: 'c1',
      version: 1,
      optimisticLock: 1,
      title: '真实HTTP保存',
      forceUpdateFields: ['title'],
    });
    await service.update(payload);
    const state = await rawRequest(routes.state);
    expect(state.calls.update).toBe(1);
    expect(state.contract.title).toBe('真实HTTP保存');
    expect(Number(state.contract.amount)).toBe(100);
    const info = await service.retrieve();
    expect(info).toHaveProperty('id', 'c1');
    expect(JSON.stringify(info)).not.toContain('"amount"');
  });

  it('无权查询条件在真实网络出口前拒绝，raw fetch绕过仍被后端拒绝且业务计数不增', async () => {
    const { access, service } = contractAccess();
    await access.ensure('list');
    expect(() => access.assertInput('list', { amount: '100.00' })).toThrow();
    await expect(service.list({ amount: '100.00' })).rejects.toThrow();
    expect(sent).toHaveLength(0);
    expect(await callCount('query')).toBe(0);
    await expect(
      rawRequest(routes.query, 'POST', { amount: '100.00' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await callCount('query')).toBe(0);
    const response = await service.list({ title: '初始' });
    expect(JSON.stringify(response)).not.toContain('"amount"');
    expect(await callCount('query')).toBe(1);
  });

  it('受限ID和版本不能被裁剪成无定位写入', async () => {
    await useActor('guest');
    const { access, fields, service } = contractAccess();
    await expect(async () => {
      await access.ensure('update');
      expect(access.allowed('update', 'input', 'id')).toBe(false);
      const payload = access.prepareAssignment(
        'update',
        { id: 'c1', version: 1, title: '不可写' },
        fields.filter((field) => field.form),
      );
      await service.update(payload);
    }).rejects.toThrow();
    expect(sent).toHaveLength(0);
    expect(await callCount('update')).toBe(0);
  });

  it.each(['split', 'low', 'guest'])(
    '%s不能通过分散角色、低等级或无操作权限访问财务输入',
    async (user) => {
      await useActor(user);
      const input = { id: 'c1', version: 1, amount: '500.00', title: '不可写' };
      await expect(requestClient.post(routes.update, input)).rejects.toThrow();
      expect(sent).toHaveLength(0);
      await expect(
        rawRequest(routes.update, 'POST', input),
      ).rejects.toMatchObject({ status: 403 });
      expect(await callCount('update')).toBe(0);
    },
  );

  it('writer撤权后后端立即拒绝旧缓存允许的输入，刷新策略后客户端也不发请求', async () => {
    await useActor('writer');
    const { access, service } = contractAccess();
    await access.ensure('update');
    expect(access.allowed('update', 'input', 'amount')).toBe(true);
    await service.update({
      id: 'c1',
      version: 1,
      amount: '200.00',
      title: '授权写入',
    });
    const before = await rawRequest(routes.state);
    expect(before.calls.update).toBe(1);
    await rawRequest('/fixture/revoke', 'POST');
    await expect(
      rawRequest(routes.update, 'POST', {
        id: 'c1',
        version: before.contract.version,
        amount: '300.00',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await callCount('update')).toBe(1);
    clearDataAttrPolicies();
    await access.ensure('update');
    expect(access.allowed('update', 'input', 'amount')).toBe(false);
    sent.splice(0);
    await expect(
      service.update({
        id: 'c1',
        version: before.contract.version,
        amount: '300.00',
      }),
    ).rejects.toThrow();
    expect(sent).toHaveLength(0);
    const info = await service.retrieve();
    expect(JSON.stringify(info)).not.toContain('"amount"');
  });

  it('真实多用户身份切换重读策略，不把writer的allowed带给reader', async () => {
    await useActor('writer');
    const { access, service } = contractAccess();
    await access.ensure('retrieve');
    expect(access.allowed('retrieve', 'output', 'amount')).toBe(true);
    expect(await service.retrieve()).toHaveProperty('amount');
    const count = metadataQueries.length;
    await useActor('reader', false);
    await access.ensure('retrieve');
    expect(metadataQueries.length).toBeGreaterThan(count);
    expect(access.allowed('retrieve', 'output', 'amount')).toBe(false);
    expect(JSON.stringify(await service.retrieve())).not.toContain('"amount"');
  });

  it('无注解真实接口重复访问复用无组策略缓存，行为保持不变', async () => {
    await requestClient.get('/fixture/plain');
    await requestClient.get('/fixture/plain');
    expect(await callCount('plain')).toBe(2);
    expect(
      metadataQueries.filter((query: any) => query.path === '/fixture/plain'),
    ).toHaveLength(1);
  });
});
