import type { DataAttrPolicy } from '../data-attr-policy';

import {
  errorMessageResponseInterceptor,
  isCancel,
} from '@vben/runtime/request';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertDataAttrInput,
  clearDataAttrPolicies,
  configureDataAttrPolicyLoader,
  DATA_ATTR_POLICY_PATH,
  fieldAllowed,
  getDataAttrPolicyEpoch,
  guardDataAttrRequest,
  loadDataAttrPolicy,
  loadDataAttrPolicyByOperation,
  pruneDataAttrInput,
  pruneDataAttrOutput,
  shouldInvalidateDataAttrPolicy,
  subscribeDataAttrPolicyInvalidation,
  suspendDataAttrPolicies,
} from '../data-attr-policy';

function policy(allowed = false): DataAttrPolicy {
  return {
    id: 'handler',
    operation: 'contract:update',
    methods: ['PUT'],
    pathPatterns: ['/contract'],
    restricted: true,
    groups: [{ id: 'finance', name: '财务信息', allowed }],
    requestRoots: [
      { location: 'body', nodeId: 'model', parameterIndex: 0 },
      { location: 'parameters', nodeId: 'model', parameterIndex: 1 },
    ],
    responseRoot: 'model',
    viewRoots: { request: ['model'], response: ['model'] },
    nodes: {
      model: {
        kind: 'object',
        fields: [
          { name: 'title', wireName: 'title', nodeId: 'value' },
          {
            name: 'amount',
            wireName: 'total',
            aliases: ['funds'],
            groupIds: ['finance'],
            nodeId: 'value',
          },
          { name: 'children', wireName: 'children', nodeId: 'array' },
          { name: 'lookup', wireName: 'lookup', nodeId: 'map' },
          ...['forceUpdateFields', 'selectColumns', 'orderBy'].map((name) => ({
            name,
            wireName: name,
            nodeId: 'value',
          })),
        ],
        selectorNodeId: 'model',
      },
      array: { kind: 'array', elementNodeId: 'model' },
      map: { kind: 'map', valueNodeId: 'model' },
      value: { kind: 'value' },
    },
  };
}

beforeEach(() => clearDataAttrPolicies());

describe('aPI属性组通用策略', () => {
  it('无权值包含null、空集合和别名时均拒绝', () => {
    for (const payload of [{ amount: null }, { total: [] }, { funds: 'x' }]) {
      expect(() => assertDataAttrInput(policy(), payload)).toThrow('未授予');
    }
    expect(() =>
      assertDataAttrInput(policy(true), { total: null }),
    ).not.toThrow();
  });
  it('嵌套数组、Map和展平属性路径递归校验', () => {
    for (const payload of [
      { children: [{ total: null }] },
      { lookup: { any: { funds: 1 } } },
      { 'children[0].total': null },
      { 'children[0]': { total: null } },
    ]) {
      expect(() => assertDataAttrInput(policy(), payload)).toThrow('未授予');
    }
  });
  it('按后端大小写和property覆盖规则匹配', () => {
    const p = policy();
    p.nodes.model!.caseInsensitive = true;
    expect(() => assertDataAttrInput(p, { FUNDS: 1 })).toThrow('未授予');
    expect(fieldAllowed(p, 'input', 'TOTAL')).toBe(false);
  });
  it('rOOT及土耳其locale折叠的碰撞字段必须全部通过', () => {
    const p = policy();
    p.nodes.model!.caseInsensitive = true;
    p.nodes.model!.locale = 'tr';
    p.nodes.model!.fields!.unshift({
      name: 'AMOUNT',
      wireName: 'AMOUNT',
      nodeId: 'value',
    });
    expect(() => assertDataAttrInput(p, { AMOUNT: 1 })).toThrow('未授予');
    p.nodes.model!.fields!.push({
      name: 'id',
      wireName: 'id',
      nodeId: 'value',
      groupIds: ['finance'],
    });
    expect(() => assertDataAttrInput(p, { ID: 1 })).toThrow('未授予');
  });
  it('普通表单参数根合并FormData、URLSearchParams及urlencoded正文', async () => {
    const p = policy();
    p.requestRoots = p.requestRoots.filter(
      (root) => root.location === 'parameters',
    );
    configureDataAttrPolicyLoader(async () => ({ version: 1, policies: [p] }));
    const form = new FormData();
    form.append('funds', '1');
    for (const data of [form, new URLSearchParams('funds=1'), 'funds=1']) {
      await expect(
        guardDataAttrRequest('POST', '/contract', {
          data,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      ).rejects.toThrow('未授予');
    }
  });
  it('表单marker/default及空数组后缀仍检查真实属性', async () => {
    const p = policy();
    p.requestRoots = p.requestRoots.filter(
      (root) => root.location === 'parameters',
    );
    configureDataAttrPolicyLoader(async () => ({ version: 1, policies: [p] }));
    for (const name of ['_total', '!total', 'total[]']) {
      await expect(
        guardDataAttrRequest('POST', '/contract', { params: { [name]: '1' } }),
      ).rejects.toThrow('未授予');
    }
  });
  it('字面量点号wireName和alias优先于路径拆分', async () => {
    const p = policy();
    p.nodes.model!.fields![1]!.aliases!.push('finance.amount');
    configureDataAttrPolicyLoader(async () => ({ version: 1, policies: [p] }));
    await expect(
      guardDataAttrRequest('PUT', '/contract', {
        data: { 'finance.amount': null },
      }),
    ).rejects.toThrow('未授予');
    expect(
      pruneDataAttrOutput(p, { 'finance.amount': 1, title: '公开' }),
    ).toEqual({ title: '公开' });
  });
  it('批量载荷逐条校验业务DTO视图根', () => {
    expect(() =>
      assertDataAttrInput(policy(), [{ title: '公开' }, { total: null }]),
    ).toThrow('未授予');
    expect(pruneDataAttrInput(policy(), [{ title: '公开', total: 1 }])).toEqual(
      [{ title: '公开' }],
    );
  });
  it('非法graph和未知节点不能作为无组放行', async () => {
    const p = policy();
    p.nodes.model!.fields![0]!.nodeId = 'missing';
    configureDataAttrPolicyLoader(async () => ({ version: 1, policies: [p] }));
    await expect(loadDataAttrPolicy('PUT', '/contract')).rejects.toThrow(
      '节点缺失',
    );
  });
  it('名为desc的受控字段仍会校验selector权限', () => {
    const p = policy();
    p.nodes.model!.fields!.push({
      name: 'desc',
      wireName: 'desc',
      nodeId: 'value',
      groupIds: ['finance'],
    });
    expect(() => assertDataAttrInput(p, { selectColumns: ['desc'] })).toThrow(
      '未授予',
    );
  });
  it('force/select/order引用源属性时拒绝且不改原载荷', () => {
    for (const payload of [
      { forceUpdateFields: ['amount'] },
      { selectColumns: ['amount'] },
      { orderBy: 'amount desc' },
      { selectColumns: '*' },
    ]) {
      const before = JSON.stringify(payload);
      expect(() => assertDataAttrInput(policy(), payload)).toThrow();
      expect(JSON.stringify(payload)).toBe(before);
    }
  });
  it('cRUD明确赋值可以投影并同步收紧forceUpdateFields', () => {
    const payload = {
      title: '公开标题',
      total: null,
      forceUpdateFields: ['amount', 'title'],
      children: [{ total: 1, title: '子项' }],
    };
    expect(pruneDataAttrInput(policy(), payload)).toEqual({
      title: '公开标题',
      forceUpdateFields: ['title'],
      children: [{ title: '子项' }],
    });
    expect(payload.total).toBeNull();
    expect(
      pruneDataAttrOutput(policy(), [{ title: '公开', total: 1 }]),
    ).toEqual([{ title: '公开' }]);
  });
  it('递归图只按实际有限载荷遍历', () => {
    expect(() =>
      assertDataAttrInput(policy(), {
        children: [{ children: [{ title: '叶子' }] }],
      }),
    ).not.toThrow();
    const circular: any = {};
    circular.children = [circular];
    expect(() => assertDataAttrInput(policy(), circular)).toThrow('循环');
  });
  it('缓存有组和无组结果、并发只发一次元数据请求', async () => {
    const load = vi.fn(async () => ({ version: 1, policies: [policy()] }));
    configureDataAttrPolicyLoader(load);
    await Promise.all([
      loadDataAttrPolicy('PUT', '/contract'),
      loadDataAttrPolicy('PUT', '/contract'),
    ]);
    expect(load).toHaveBeenCalledTimes(1);
    const none = {
      ...policy(),
      restricted: false,
      responseRoot: null,
      groups: [],
      nodes: {},
      requestRoots: [],
      viewRoots: { request: [], response: [] },
    };
    load.mockResolvedValue({ version: 1, policies: [none] });
    clearDataAttrPolicies();
    await guardDataAttrRequest('PUT', '/other', { data: { amount: null } });
    await guardDataAttrRequest('PUT', '/other', { data: { amount: null } });
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('失效立即通知UI并拒绝旧会话在途结果', async () => {
    let resolve!: (value: any) => void;
    configureDataAttrPolicyLoader(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const notify = vi.fn();
    const unsubscribe = subscribeDataAttrPolicyInvalidation(notify);
    const old = loadDataAttrPolicy('PUT', '/contract');
    clearDataAttrPolicies();
    expect(notify).toHaveBeenCalledOnce();
    resolve({ version: 1, policies: [policy(true)] });
    const canceled = await old.catch((error) => error);
    expect(canceled.message).toContain('身份或权限');
    expect(isCancel(canceled)).toBe(true);
    const showError = vi.fn();
    await expect(
      errorMessageResponseInterceptor(showError).rejected?.(canceled),
    ).rejects.toBe(canceled);
    expect(showError).not.toHaveBeenCalled();
    unsubscribe();
  });
  it('失败不会缓存为无组或放行下一次调用', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('策略服务失败'))
      .mockResolvedValue({ version: 1, policies: [policy()] });
    configureDataAttrPolicyLoader(load);
    await expect(
      guardDataAttrRequest('PUT', '/contract', { data: { total: null } }),
    ).rejects.toThrow('策略服务失败');
    await expect(
      guardDataAttrRequest('PUT', '/contract', { data: { total: null } }),
    ).rejects.toThrow('未授予');
    expect(isCancel(new Error('未授予该字段权限'))).toBe(false);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('暂停策略读取按取消拒绝，而真实字段授权拒绝仍进入错误提示', async () => {
    configureDataAttrPolicyLoader(async () => ({
      version: 1,
      policies: [policy()],
    }));
    const denied = await guardDataAttrRequest('PUT', '/contract', {
      data: { total: null },
    }).catch((error) => error);
    expect(denied.message).toContain('未授予');
    expect(isCancel(denied)).toBe(false);
    const showError = vi.fn();
    await expect(
      errorMessageResponseInterceptor(showError).rejected?.(denied),
    ).rejects.toBe(denied);
    expect(showError).toHaveBeenCalledTimes(1);
    suspendDataAttrPolicies();
    const canceled = await loadDataAttrPolicy('GET', '/contract').catch(
      (error) => error,
    );
    expect(isCancel(canceled)).toBe(true);
    await expect(
      errorMessageResponseInterceptor(showError).rejected?.(canceled),
    ).rejects.toBe(canceled);
    expect(showError).toHaveBeenCalledTimes(1);
  });

  it('策略自身403不广播失效或自动重读，业务403仍撤销缓存', async () => {
    const metadataError = {
      response: {
        status: 403,
        config: { method: 'post', url: DATA_ATTR_POLICY_PATH, baseURL: '' },
      },
    };
    const load = vi.fn().mockRejectedValue(metadataError);
    configureDataAttrPolicyLoader(load);
    const epoch = getDataAttrPolicyEpoch();
    const notify = vi.fn();
    const unsubscribe = subscribeDataAttrPolicyInvalidation(notify);
    try {
      await loadDataAttrPolicy('GET', '/contract');
    } catch (error) {
      if (shouldInvalidateDataAttrPolicy(error)) clearDataAttrPolicies();
    }
    expect(load).toHaveBeenCalledTimes(1);
    expect(getDataAttrPolicyEpoch()).toBe(epoch);
    expect(notify).not.toHaveBeenCalled();
    const businessError = {
      response: { status: 403, config: { method: 'put', url: '/contract' } },
    };
    if (shouldInvalidateDataAttrPolicy(businessError)) clearDataAttrPolicies();
    expect(notify).toHaveBeenCalledOnce();
    expect(getDataAttrPolicyEpoch()).toBe(epoch + 1);
    unsubscribe();
  });
  it('多handler操作必须显式指定实际请求目标', async () => {
    configureDataAttrPolicyLoader(async (query) => ({
      version: 1,
      policies: 'operation' in query ? [policy(), policy()] : [policy()],
    }));
    await expect(
      loadDataAttrPolicyByOperation('contract:update'),
    ).rejects.toThrow('不明确');
    await expect(
      loadDataAttrPolicyByOperation('contract:update', {
        method: 'PUT',
        path: '/contract',
      }),
    ).resolves.toHaveProperty('id', 'handler');
  });
  it('通用guard检查body、query、FormData且不删除条件', async () => {
    configureDataAttrPolicyLoader(async () => ({
      version: 1,
      policies: [policy()],
    }));
    const form = new FormData();
    form.append('funds', '1');
    await expect(
      guardDataAttrRequest('PUT', '/contract', { data: form }),
    ).rejects.toThrow('未授予');
    await expect(
      guardDataAttrRequest('PUT', '/contract?funds=1'),
    ).rejects.toThrow('未授予');
    await expect(
      guardDataAttrRequest('PUT', '/contract', {
        params: { 'children[0].total': null },
      }),
    ).rejects.toThrow('未授予');
  });
});

describe('通用网络出口', () => {
  it('requestService、CRUD helper和公共客户端在无权时均不发写请求', async () => {
    const { setAdminFrameworkRuntime, requestClient } =
      await import('../runtime');
    const { RequestService } = await import('../request-service');
    const { createCrudRecord, updateCrudRecord, fetchCrudList } =
      await import('../api');
    const transport: any = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    };
    setAdminFrameworkRuntime({ requestClient: transport });
    configureDataAttrPolicyLoader(async () => ({
      version: 1,
      policies: [policy()],
    }));
    class TestService extends RequestService {
      update(data: unknown) {
        return this.request({ path: '/contract', method: 'PUT', data });
      }
    }
    await expect(new TestService().update({ total: null })).rejects.toThrow(
      '未授予',
    );
    await expect(
      createCrudRecord('/contract', { total: null }),
    ).rejects.toThrow('未授予');
    await expect(
      updateCrudRecord('/contract', { total: null }),
    ).rejects.toThrow('未授予');
    await expect(
      requestClient.post('/contract', { total: null }),
    ).rejects.toThrow('未授予');
    await expect(
      fetchCrudList('/contract', { orderBy: 'amount desc' }),
    ).rejects.toThrow('未授予');
    expect(transport.post).not.toHaveBeenCalled();
    expect(transport.put).not.toHaveBeenCalled();
    expect(transport.request).not.toHaveBeenCalled();
    expect(transport.get).not.toHaveBeenCalled();
  });
  it('有权写入只提交一次，无组请求保留原有字段和null', async () => {
    const { setAdminFrameworkRuntime, requestClient } =
      await import('../runtime');
    const put = vi.fn().mockResolvedValue('ok');
    setAdminFrameworkRuntime({ requestClient: { put } as any });
    configureDataAttrPolicyLoader(async () => ({
      version: 1,
      policies: [policy(true)],
    }));
    const payload = { total: null, title: '原始载荷' };
    await expect(requestClient.put('/contract', payload)).resolves.toBe('ok');
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0]![1]).toBe(payload);
  });
});
