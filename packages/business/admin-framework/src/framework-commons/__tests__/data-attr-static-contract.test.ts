import type { DataAttrStaticPolicy } from '../data-attr-policy';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearDataAttrPolicies,
  fieldAllowed,
  initializeDataAttrFieldGrants,
  loadDataAttrPolicy,
  registerDataAttrStaticContract,
} from '../data-attr-policy';

const definition: DataAttrStaticPolicy = {
  id: 'static-contract-test',
  operation: 'static:test:read',
  methods: ['GET'],
  pathPatterns: ['/static-test/items/{id}'],
  restricted: true,
  groups: [{ id: 'finance', name: '财务信息', authorizable: true }],
  requestRoots: [],
  responseRoot: 'model',
  viewRoots: { request: [], response: ['model'] },
  nodes: {
    model: {
      kind: 'object',
      fields: [
        {
          name: 'amount',
          wireName: 'amount',
          nodeId: 'value',
          groupIds: ['finance'],
        },
      ],
    },
    value: { kind: 'value' },
  },
};
beforeEach(() => {
  clearDataAttrPolicies();
});
describe('开发期字段静态契约', () => {
  it('按操作和分组合并授权，切换身份后保留静态声明', async () => {
    registerDataAttrStaticContract({ version: 1, policies: [definition] });
    initializeDataAttrFieldGrants({
      version: 1,
      allowed: [
        { operation: definition.operation || '', groupKeys: ['finance'] },
      ],
    });
    expect(
      fieldAllowed(
        await loadDataAttrPolicy('GET', '/static-test/items/42'),
        'output',
        'amount',
      ),
    ).toBe(true);
    clearDataAttrPolicies();
    await expect(
      loadDataAttrPolicy('GET', '/static-test/items/42'),
    ).rejects.toThrow('尚未就绪');
    initializeDataAttrFieldGrants({
      version: 1,
      allowed: [{ operation: 'other:read', groupKeys: ['finance'] }],
    });
    expect(
      fieldAllowed(
        await loadDataAttrPolicy('GET', '/static-test/items/42'),
        'output',
        'amount',
      ),
    ).toBe(false);
  });
  it('不可授权分组始终拒绝，精确路径优先于模板路径', async () => {
    registerDataAttrStaticContract({
      version: 1,
      policies: [
        definition,
        {
          ...definition,
          id: 'static-contract-specific',
          pathPatterns: ['/static-test/items/special'],
          groups: [{ id: 'finance', name: '财务信息', authorizable: false }],
        },
      ],
    });
    initializeDataAttrFieldGrants({
      version: 1,
      allowed: [
        { operation: definition.operation || '', groupKeys: ['finance'] },
      ],
    });
    expect(
      fieldAllowed(
        await loadDataAttrPolicy('GET', '/static-test/items/special'),
        'output',
        'amount',
      ),
    ).toBe(false);
  });
  it('未声明接口仅警告一次，切换身份后重置警告', async () => {
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unknown = await loadDataAttrPolicy('GET', '/static-unknown?q=secret');
    expect(unknown.restricted).toBe(false);
    await loadDataAttrPolicy('GET', '/static-unknown?q=other');
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0]?.join(' ')).not.toContain('secret');
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    await loadDataAttrPolicy('GET', '/static-unknown');
    expect(warning).toHaveBeenCalledTimes(2);
    warning.mockRestore();
  });
  it('支持未绑定操作，调用方不能篡改已注册的字段图', async () => {
    registerDataAttrStaticContract({
      version: 1,
      policies: [
        {
          ...definition,
          id: 'no-operation',
          operation: null,
          pathPatterns: ['/static-no-operation'],
        },
      ],
    });
    initializeDataAttrFieldGrants({
      version: 1,
      allowed: [{ operation: '', groupKeys: ['finance'] }],
    });
    const result = await loadDataAttrPolicy('GET', '/static-no-operation');
    expect(fieldAllowed(result, 'output', 'amount')).toBe(false);
    if (result.nodes.model) result.nodes.model.fields = [];
    expect(
      fieldAllowed(
        await loadDataAttrPolicy('GET', '/static-no-operation'),
        'output',
        'amount',
      ),
    ).toBe(false);
  });
  it('延迟注册子模块保留就绪状态，未授予的操作仍受限', async () => {
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    registerDataAttrStaticContract({
      version: 1,
      policies: [
        {
          ...definition,
          id: 'late-module',
          operation: 'other:read',
          pathPatterns: ['/other-module/read'],
        },
      ],
    });
    expect(
      fieldAllowed(
        await loadDataAttrPolicy('GET', '/other-module/read'),
        'output',
        'amount',
      ),
    ).toBe(false);
  });
  it('匹配正则与嵌入式路径参数、通配父路径和请求方法', async () => {
    registerDataAttrStaticContract({
      version: 1,
      policies: [
        {
          ...definition,
          id: 'regex-variable',
          pathPatterns: ['/static-regex/{id:[0-9]{2}}.json'],
        },
        { ...definition, id: 'catch-all', pathPatterns: ['/static-files/**'] },
      ],
    });
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    const regexMatch = await loadDataAttrPolicy('GET', '/static-regex/12.json');
    const parentMatch = await loadDataAttrPolicy('GET', '/static-files');
    const childMatch = await loadDataAttrPolicy('GET', '/static-files/a/b');
    expect(regexMatch.id).toBe('regex-variable');
    expect(parentMatch.id).toBe('catch-all');
    expect(childMatch.id).toBe('catch-all');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const postMatch = await loadDataAttrPolicy('POST', '/static-regex/12.json');
    expect(postMatch.restricted).toBe(false);
    warning.mockRestore();
  });
  it('登录身份变化时取消旧会话排队读取', async () => {
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    const oldRead = loadDataAttrPolicy('GET', '/static-test/items/42');
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    await expect(oldRead).rejects.toThrow('身份或权限已变化');
  });
  it('重复目标全部明确无组且不受控时复用结果，不产生缺失警告', async () => {
    const unrestricted = {
      ...definition,
      restricted: false,
      groups: [],
      nodes: {},
      requestRoots: [],
      responseRoot: null,
      viewRoots: { request: [], response: [] },
    };
    registerDataAttrStaticContract({
      version: 1,
      policies: [
        {
          ...unrestricted,
          id: 'unrestricted-enums-one',
          operation: 'enums:one',
          pathPatterns: ['/static-duplicate/enums'],
        },
        {
          ...unrestricted,
          id: 'unrestricted-enums-two',
          operation: 'enums:two',
          pathPatterns: ['/static-duplicate/enums'],
        },
        {
          ...unrestricted,
          id: 'unrestricted-login-one',
          operation: null,
          methods: ['POST'],
          pathPatterns: ['/static-duplicate/login'],
        },
        {
          ...unrestricted,
          id: 'unrestricted-login-two',
          operation: null,
          methods: ['POST'],
          pathPatterns: ['/static-duplicate/login'],
        },
      ],
    });
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const enums = await loadDataAttrPolicy('GET', '/static-duplicate/enums');
    const login = await loadDataAttrPolicy('POST', '/static-duplicate/login');
    expect(enums.restricted).toBe(false);
    expect(login.restricted).toBe(false);
    expect(warning).not.toHaveBeenCalled();
    warning.mockRestore();
  });
  it('重复目标中只要包含受控声明或非空分组，就拒绝歧义而不降级', async () => {
    const empty = {
      ...definition,
      restricted: false,
      groups: [],
      nodes: {},
      requestRoots: [],
      responseRoot: null,
      viewRoots: { request: [], response: [] },
    };
    const grouped = { ...definition, restricted: false };
    for (const [index, conflicting] of [
      { ...empty, restricted: true },
      grouped,
    ].entries()) {
      const path = `/static-mixed-duplicate/${index}`;
      registerDataAttrStaticContract({
        version: 1,
        policies: [
          { ...empty, id: `mixed-empty-${index}`, pathPatterns: [path] },
          {
            ...conflicting,
            id: `mixed-conflicting-${index}`,
            pathPatterns: [path],
          },
        ],
      });
      initializeDataAttrFieldGrants({ version: 1, allowed: [] });
      await expect(loadDataAttrPolicy('GET', path)).rejects.toThrow('不唯一');
    }
  });
  it('拒绝无效声明及同优先级的歧义路径', async () => {
    expect(() =>
      registerDataAttrStaticContract({
        version: 1,
        policies: [{ ...definition, id: 'invalid-static', groups: [] }],
      }),
    ).toThrow();
    registerDataAttrStaticContract({
      version: 1,
      policies: [
        {
          ...definition,
          id: 'ambiguous-one',
          pathPatterns: ['/static-ambiguous/{id}'],
        },
        {
          ...definition,
          id: 'ambiguous-two',
          pathPatterns: ['/static-ambiguous/{name}'],
        },
      ],
    });
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    await expect(
      loadDataAttrPolicy('GET', '/static-ambiguous/1'),
    ).rejects.toThrow('不唯一');
  });
});
