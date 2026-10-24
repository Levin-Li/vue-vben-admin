import type { DataAttrPolicy } from '../../data-attr-policy';

import { flushPromises } from '@vue/test-utils';
import { effectScope, nextTick, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { configureDataAttrPolicyLoader } from '../../data-attr-policy';
import { useCrudDataAttrAccess } from '../crud-data-attr-access';

describe('外部身份更新后的属性组缓存', () => {
  it('身份签名改变会重新读取后端策略，不复用上个身份的allowed结论', async () => {
    const identity = ref('reader');
    const loader = vi.fn(async () => {
      const policy: DataAttrPolicy = {
        id: 'identity-fixture',
        operation: 'fixture:contract::update',
        methods: ['PUT'],
        pathPatterns: ['/Contract/update'],
        restricted: true,
        groups: [
          {
            id: 'finance',
            name: '财务信息',
            allowed: identity.value === 'writer',
          },
        ],
        requestRoots: [{ location: 'body', nodeId: 'dto', parameterIndex: 0 }],
        responseRoot: 'dto',
        viewRoots: { request: ['dto'], response: ['dto'] },
        nodes: {
          dto: {
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
      return { version: 1, policies: [policy] };
    });
    configureDataAttrPolicyLoader(loader);
    const scope = effectScope();
    try {
      const access = scope.run(() =>
        useCrudDataAttrAccess(
          () => ({ apiBase: '/Contract', title: '合同', fields: [] }),
          () => '/Contract/list',
          () => identity.value,
        ),
      );
      if (!access) throw new Error('Missing access scope');
      await access.ensure('update');
      expect(access.allowed('update', 'input', 'amount')).toBe(false);
      const before = loader.mock.calls.length;
      identity.value = 'writer';
      await nextTick();
      await flushPromises();
      await access.ensure('update');
      expect(loader.mock.calls.length).toBeGreaterThan(before);
      expect(access.allowed('update', 'input', 'amount')).toBe(true);
    } finally {
      scope.stop();
    }
  });
});

// 显式策略来源与全局授权加载独立，仍遵守操作权限和当前上下文。
describe('页面显式字段策略', () => {
  const validPolicy: DataAttrPolicy = {
    id: 'page-provider',
    operation: '',
    methods: [],
    pathPatterns: [],
    restricted: false,
    groups: [],
    nodes: {},
    requestRoots: [],
    viewRoots: { request: [], response: [] },
  };

  it('并发请求去重，失败关闭且不回退全局加载器，非法返回也拒绝', async () => {
    const fallback = vi.fn(async () => ({
      version: 1,
      policies: [validPolicy],
    }));
    configureDataAttrPolicyLoader(fallback);
    const provider = vi.fn(async () => validPolicy);
    const scope = effectScope();
    const access = scope.run(() =>
      useCrudDataAttrAccess(
        () => ({
          apiBase: '/Dynamic',
          title: '动态',
          fields: [],
          dataAttrPolicyProvider: provider,
        }),
        () => '/Dynamic/list',
        () => 'actor',
        (operation) => operation === 'update',
      ),
    );
    if (!access) throw new Error('测试作用域未创建');
    try {
      const first = access.ensure('update');
      expect(access.ensure('update')).toBe(first);
      await first;
      expect(provider).toHaveBeenCalledOnce();
      expect(access.allowed('update', 'input', 'name')).toBe(true);
      const oldCheckpoint = access.checkpoint();
      provider.mockRejectedValueOnce(new Error('策略不可用'));
      await expect(access.ensure('update', true)).rejects.toThrow('策略不可用');
      expect(() => access.assertCheckpoint(oldCheckpoint)).toThrow(
        '权限上下文已变化',
      );
      expect(access.allowed('update', 'input', 'name')).toBe(false);
      provider.mockResolvedValueOnce({
        ...validPolicy,
        viewRoots: undefined,
      } as unknown as DataAttrPolicy);
      await expect(access.ensure('update')).rejects.toThrow('策略根无效');
      await expect(access.ensure('delete')).rejects.toThrow('没有权限');
      expect(fallback).not.toHaveBeenCalled();
    } finally {
      scope.stop();
    }
  });

  it('身份或模型配置变化使旧promise失效，只接受最新策略', async () => {
    const identity = ref('first');
    const oldResponses: Array<(value: DataAttrPolicy) => void> = [];
    const provider = vi.fn(
      () =>
        new Promise<DataAttrPolicy>((resolve) => oldResponses.push(resolve)),
    );
    const config = ref({
      apiBase: '/Dynamic/a',
      title: '动态',
      fields: [],
      dataAttrPolicyProvider: provider,
    });
    const scope = effectScope();
    const access = scope.run(() =>
      useCrudDataAttrAccess(
        () => config.value,
        () => `${config.value.apiBase}/list`,
        () => identity.value,
        (operation) => operation === 'update',
      ),
    );
    if (!access) throw new Error('测试作用域未创建');
    try {
      const first = access.ensure('update');
      const rejection = expect(first).rejects.toThrow('授权上下文已变化');
      await flushPromises();
      identity.value = 'second';
      await nextTick();
      await flushPromises();
      oldResponses[0]?.(validPolicy);
      await rejection;
      const second = access.ensure('update');
      const secondRejection =
        expect(second).rejects.toThrow('授权上下文已变化');
      config.value = { ...config.value, apiBase: '/Dynamic/b' };
      await nextTick();
      await flushPromises();
      oldResponses[1]?.(validPolicy);
      await secondRejection;
      const current = access.ensure('update');
      oldResponses[2]?.(validPolicy);
      await current;
      expect(access.allowed('update', 'input', 'name')).toBe(true);
    } finally {
      scope.stop();
    }
  });
});
