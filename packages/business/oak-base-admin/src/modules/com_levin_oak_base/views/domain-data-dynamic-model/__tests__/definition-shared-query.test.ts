import type { DataModelDefinition } from '../../../api/data-model-service';

import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from '@vue/test-utils';

import { configureDataAttrPolicyLoader } from '@levin/admin-framework/framework-commons/data-attr-policy';
import DynamicCrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDynamicCrudAdapter } from '../../data-model-record/standard-crud-adapter';
import { definitionCrudConfig } from '../definition-crud-adapter';

const mocks = vi.hoisted(() => ({
  queryModels: vi.fn(),
  queryRecords: vi.fn(),
  formContext: vi.fn(),
  get: vi.fn(),
  error: vi.fn(),
  user: { userInfo: { id: 'sa', roles: ['R_PLATFORM_SA'] } },
  access: { accessCodes: ['*'] },
  route: {
    path: '/clob/V1/DomainDataDynamicModel',
    matched: [],
    meta: {},
    query: {},
  },
}));
vi.mock('../../../api/data-model-service', () => ({
  dataModelService: {
    queryModels: mocks.queryModels,
    queryRecords: mocks.queryRecords,
    formContext: mocks.formContext,
    getDefinition: vi.fn(),
    save: vi.fn(),
  },
}));
vi.mock('../../../api/_module', () => ({
  OAK_BASE_API_MODULE: '/com.levin.oak.base/V1/api',
}));
vi.mock('@levin/admin-framework/framework-commons/app/api/request', () => ({
  requestClient: {
    get: mocks.get,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  },
  baseRequestClient: { get: mocks.get },
}));
vi.mock('@levin/admin-framework/framework-commons/runtime', () => ({
  requestClient: {
    get: mocks.get,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock('@vben/runtime/stores', () => ({
  getTabKey: (route: { path: string }) => route.path,
  useUserStore: () => mocks.user,
  useAccessStore: () => mocks.access,
  useTabbarStore: () => ({ setPageKeepAlive: vi.fn() }),
}));
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('ant-design-vue', async (original) => ({
  ...(await original<typeof import('ant-design-vue')>()),
  message: {
    error: mocks.error,
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

enableAutoUnmount(afterEach);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation(async (path: string) =>
    path.includes('/UiSetting/use/resolve')
      ? { data: { data: null }, headers: {} }
      : [],
  );
  configureDataAttrPolicyLoader(async () => ({
    version: 1,
    policies: [
      {
        id: 'management',
        operation: 'management',
        methods: [],
        pathPatterns: [],
        restricted: false,
        groups: [],
        nodes: { value: { kind: 'value' } },
        requestRoots: [
          { location: 'body', parameterIndex: 0, nodeId: 'value' },
        ],
        viewRoots: { request: ['value'], response: ['value'] },
      },
    ],
  }));
  mocks.queryModels.mockImplementation(
    async (query: { key?: string; page: number; size: number }) => ({
      items: query.key
        ? []
        : [{ key: 'v3', name: 'v3', title: '示例模型', fields: [] }],
      total: query.key ? 0 : 1,
      page: query.page,
      size: query.size,
    }),
  );
});

describe('模型管理真实公共查询链路', () => {
  it('无匹配查询后重置及刷新能重新取数并结束loading', async () => {
    const config = definitionCrudConfig({
      context: () => 'actor',
      ownerAllowed: true,
      ownerLoader: async () => [],
      scopes: [{ label: '私人', value: 'PRIVATE' }],
      rowActions: [],
    });
    const wrapper = shallowMount(DynamicCrudPage, {
      props: { config },
      global: {
        plugins: [createPinia()],
        config: {
          errorHandler: (error) => {
            throw error;
          },
        },
      },
    });
    await flushPromises();
    const vm = (wrapper.vm.$ as unknown as { setupState: Record<string, any> })
      .setupState;
    expect(vm.dataSource).toHaveLength(1);
    vm.searchState.key = 'no_match_model';
    await vm.loadList();
    expect(vm.dataSource).toEqual([]);
    expect(vm.loading).toBe(false);
    vm.searchExpanded = true;
    const beforeReset = mocks.queryModels.mock.calls.length;
    vm.resetSearch();
    await flushPromises();
    expect(vm.searchState.key).toBeUndefined();
    expect(mocks.queryModels).toHaveBeenCalledTimes(beforeReset);
    expect(vm.searchExpanded).toBe(true);
    expect(vm.dataSource).toEqual([]);
    await vm.refreshTable();
    await flushPromises();
    expect(vm.loading).toBe(false);
    expect(vm.dataSource).toHaveLength(1);
    expect(mocks.queryModels.mock.calls.at(-1)?.[0]).not.toHaveProperty('key');
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it('运行页打开新增不改变查询字段，正常记录有内置编辑删除入口', async () => {
    const parameters = [
      {
        name: 'amount',
        title: '金额',
        type: 'MONEY',
        source: 'BUSINESS',
        nullable: false,
        defaultValue: '99.01',
      },
      {
        name: 'name',
        title: '名称',
        type: 'STRING',
        source: 'BUSINESS',
        nullable: false,
        defaultValue: 'new',
      },
    ];
    const model: DataModelDefinition = {
      key: 'runtime',
      name: 'Runtime',
      title: '运行',
      namingVersion: 2,
      fields: [
        {
          key: 'amount',
          name: 'amount',
          title: '金额',
          type: 'MONEY',
          nullable: false,
        },
        {
          key: 'name',
          name: 'name',
          title: '名称',
          type: 'STRING',
          nullable: false,
        },
      ],
      systemFields: ['id', 'optimisticLock', 'editable', 'enable'].map(
        (name) => ({
          key: `RECORD_SYSTEM.${name}`,
          name,
          title: name,
          type: 'STRING',
          nullable: false,
          source: 'RECORD_SYSTEM',
        }),
      ),
      operations: (['QUERY', 'CREATE', 'EDIT', 'DELETE'] as const).map(
        (code) => ({
          code,
          title: code,
          method: 'POST',
          path: code,
          permissionExpr: `p:${code}`,
          authorized: true,
          available: true,
          enabled: true,
          requestParams: parameters,
          responseParams: parameters,
        }),
      ),
      operationFields: {
        LIST: ['id', 'optimisticLock', 'editable', 'enable', 'amount', 'name'],
      },
      queryInputs: [
        {
          key: '__query_f_amount_eq',
          field: 'amount',
          title: '金额等于',
          type: 'MONEY',
          operator: 'EQ',
          defaultVisible: true,
        },
        {
          key: '__query_f_name_eq',
          field: 'name',
          title: '名称等于',
          type: 'STRING',
          operator: 'EQ',
          defaultVisible: true,
        },
      ],
    };
    const row = {
      id: 'row',
      optimisticLock: 0,
      editable: true,
      enable: true,
      amount: '100.12',
      name: 'x',
    };
    mocks.queryRecords.mockResolvedValue({ items: [row], total: 1 });
    mocks.formContext.mockResolvedValue({
      fields: parameters,
      scope: {},
      options: {},
    });
    const adapter = createDynamicCrudAdapter(model, () => 'actor');
    const wrapper = shallowMount(DynamicCrudPage, {
      props: { config: adapter.config },
      global: {
        plugins: [createPinia()],
        config: {
          errorHandler: (error) => {
            throw error;
          },
        },
      },
    });
    await flushPromises();
    const vm = (wrapper.vm.$ as unknown as { setupState: Record<string, any> })
      .setupState;
    const before = vm.searchFields.map((field: { key: string }) => field.key);
    expect(before).toContain('__query_f_amount_eq');
    expect(vm.canShowBuiltinEdit(row)).toBe(true);
    expect(vm.canShowBuiltinDelete(row)).toBe(true);
    vm.searchExpanded = true;
    vm.searchState.__query_f_amount_eq = '99.01';
    const beforeReset = mocks.queryRecords.mock.calls.length;
    vm.resetSearch();
    await flushPromises();
    expect(vm.searchState.__query_f_amount_eq).toBeUndefined();
    expect(mocks.queryRecords).toHaveBeenCalledTimes(beforeReset);
    expect(vm.searchExpanded).toBe(true);
    expect(vm.dataSource).toEqual([row]);

    adapter.chooseCreate('CREATE');
    await vm.handleCreate();
    await flushPromises();
    expect(vm.searchFields.map((field: { key: string }) => field.key)).toEqual(
      before,
    );
    expect(vm.canShowBuiltinEdit({ ...row, editable: false })).toBe(false);
    expect(vm.canShowBuiltinDelete({ ...row, editable: false })).toBe(false);
  });
});
