import type { CrudPageConfig } from '../types';

import { flushPromises } from '@vue/test-utils';
import { effectScope, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { ResAuthorize } from '../../api-authorize';
import {
  clearDataAttrPolicies,
  configureDataAttrPolicyLoader,
} from '../../data-attr-policy';
import {
  isCrudDataAttrOperationEnabled,
  useCrudDataAttrAccess,
} from '../crud-data-attr-access';

function configuration(): CrudPageConfig {
  const service: Record<string, any> = {};
  for (const method of [
    'create',
    'update',
    'list',
    'retrieve',
    'delete',
    'batchCreate',
  ]) {
    service[method] = vi.fn();
    ResAuthorize({ domain: 'fixture', type: '用户', action: method })(
      service,
      method,
      Object.getOwnPropertyDescriptor(service, method) || {
        value: service[method],
      },
    );
  }
  return { apiBase: '/User', title: '用户', fields: [], apiService: service };
}

describe('cRUD字段策略只预取当前可用操作', () => {
  it('普通只读角色不预取不存在的批量接口、隐藏新增删除及未获权更新', async () => {
    const config = configuration();
    const allowed = new Set(['list', 'retrieve']);
    const permission = (values: string | string[] | undefined) =>
      (Array.isArray(values) ? values : [values]).some((value) =>
        allowed.has(String(value).split(':').at(-1) || ''),
      );
    const calls: string[] = [];
    configureDataAttrPolicyLoader(async (query) => {
      if (!('operation' in query)) throw new Error('不应猜测未注册接口');
      const operation = query.operation.split(':').at(-1) || '';
      calls.push(operation);
      if (!allowed.has(operation)) throw new Error('Unauthorized operation');
      return {
        version: 1,
        policies: [
          {
            id: operation,
            operation: query.operation,
            methods: [],
            pathPatterns: [],
            restricted: false,
            groups: [],
            nodes: {},
            requestRoots: [],
            viewRoots: { request: [], response: [] },
          },
        ],
      };
    });
    const scope = effectScope();
    try {
      const access = scope.run(() =>
        useCrudDataAttrAccess(
          () => config,
          () => '/User/list',
          () => 'reader',
          (operation) =>
            isCrudDataAttrOperationEnabled(config, operation, permission),
        ),
      );
      await flushPromises();
      expect(calls.toSorted()).toEqual(['list', 'retrieve']);
      await expect(access?.ensure('create')).rejects.toThrow('没有权限');
      clearDataAttrPolicies();
      await flushPromises();
      expect(calls).toHaveLength(4);
      expect(calls.every((method) => allowed.has(method))).toBe(true);
    } finally {
      scope.stop();
    }
  });

  it('仅列表权限变化和缓存页恢复时重新计算策略，禁用页不在后台预取', async () => {
    const active = ref(true);
    const config = configuration();
    config.allowCreate = false;
    config.allowDelete = false;
    config.allowEdit = false;
    config.allowRetrieve = false;
    delete config.apiService?.batchCreate;
    const loader = vi.fn(
      async (
        query: Parameters<
          Parameters<typeof configureDataAttrPolicyLoader>[0]
        >[0],
      ) => ({
        version: 1,
        policies: [
          {
            id: 'list',
            operation: 'operation' in query ? query.operation : '',
            methods: [],
            pathPatterns: [],
            restricted: false,
            groups: [],
            nodes: {},
            requestRoots: [],
            viewRoots: { request: [], response: [] },
          },
        ],
      }),
    );
    configureDataAttrPolicyLoader(loader);
    const scope = effectScope();
    try {
      scope.run(() =>
        useCrudDataAttrAccess(
          () => config,
          () => '/User/list',
          () => 'reader',
          (operation) =>
            active.value &&
            isCrudDataAttrOperationEnabled(config, operation, () => true),
        ),
      );
      await flushPromises();
      expect(loader).toHaveBeenCalledOnce();
      active.value = false;
      await flushPromises();
      clearDataAttrPolicies();
      await flushPromises();
      expect(loader).toHaveBeenCalledOnce();
      active.value = true;
      await flushPromises();
      expect(loader).toHaveBeenCalledTimes(2);
    } finally {
      scope.stop();
    }
  });
});
