import type { DataAttrPolicy } from '../../data-attr-policy';
import type { CrudPageConfig } from '../types';

import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResAuthorize } from '../../api-authorize';
import {
  clearDataAttrPolicies,
  configureDataAttrPolicyLoader,
} from '../../data-attr-policy';
import CrudPage from '../crud-page.vue';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  request: vi.fn(),
  delete: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  route: { path: '/contracts', meta: {} as Record<string, any>, query: {} },
  user: { userInfo: { id: 'tester' } },
  access: { accessCodes: [] as string[] },
}));
vi.mock('../../app/api/request', () => ({
  requestClient: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    request: mocks.request,
    delete: mocks.delete,
  },
  baseRequestClient: { get: mocks.get },
}));
vi.mock('../../runtime', () => ({
  requestClient: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    request: mocks.request,
    delete: mocks.delete,
  },
}));
vi.mock('../../rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => mocks.user,
  useAccessStore: () => mocks.access,
}));
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('ant-design-vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ant-design-vue')>()),
  message: {
    error: mocks.error,
    warning: mocks.warning,
    success: vi.fn(),
    info: vi.fn(),
  },
}));

enableAutoUnmount(afterEach);
function policy(operation = 'contract:合同::操作'): DataAttrPolicy {
  return {
    id: operation,
    operation,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    pathPatterns: ['/any'],
    restricted: true,
    groups: [{ id: 'finance', name: '财务信息', allowed: false }],
    requestRoots: [{ location: 'body', nodeId: 'dto', parameterIndex: 0 }],
    responseRoot: 'dto',
    viewRoots: { request: ['dto'], response: ['dto'] },
    nodes: {
      dto: {
        kind: 'object',
        selectorNodeId: 'dto',
        fields: [
          {
            name: 'amount',
            wireName: 'amount',
            groupIds: ['finance'],
            nodeId: 'value',
          },
          { name: 'name', wireName: 'name', groupIds: [], nodeId: 'value' },
          {
            name: 'forceUpdateFields',
            wireName: 'forceUpdateFields',
            groupIds: [],
            nodeId: 'value',
          },
          {
            name: 'orderBy',
            wireName: 'orderBy',
            groupIds: [],
            nodeId: 'value',
          },
        ],
      },
      value: { kind: 'value' },
    },
  };
}
function config(overrides: Partial<CrudPageConfig> = {}): CrudPageConfig {
  return {
    apiBase: '/Contract',
    title: '合同',
    fields: [
      { key: 'name', label: '名称', form: true, table: true },
      {
        key: 'amount',
        label: '金额',
        required: true,
        form: true,
        table: true,
        search: true,
        export: true,
      },
    ],
    ...overrides,
  };
}
function setupState(wrapper: ReturnType<typeof shallowMount>) {
  return (wrapper.vm.$ as unknown as { setupState: Record<string, any> })
    .setupState;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.route.meta = {};
  mocks.get.mockImplementation(async (path: string) =>
    path.includes('/list')
      ? { items: [{ id: '1', name: '合同甲', amount: 500 }], totals: 1 }
      : [],
  );
  mocks.post.mockResolvedValue({});
  mocks.put.mockResolvedValue({});
  configureDataAttrPolicyLoader(async (query) => ({
    version: 1,
    policies: [
      policy('operation' in query ? query.operation : 'contract:合同::操作'),
    ],
  }));
});

describe('标准 crud 的属性组策略', () => {
  it('辅助选项失败在当前授权上下文只尝试一次，权限变化允许重试且停用页不加载', async () => {
    const loader = vi
      .fn()
      .mockRejectedValue(new Error('Unauthorized operation'));
    const field = {
      key: 'level',
      label: '用户等级',
      table: false,
      loadOptions: loader,
    };
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config({ fields: [field] }) },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.loadTableDisplayOptions(field);
    clearDataAttrPolicies();
    await flushPromises();
    await vm.loadTableDisplayOptions(field);
    expect(loader).toHaveBeenCalledOnce();
    expect(mocks.warning).toHaveBeenCalledWith(
      expect.stringContaining('暂显示原始值'),
    );
    vm.pageActive = false;
    mocks.access.accessCodes = ['new-grant'];
    await vm.loadTableDisplayOptions(field);
    expect(loader).toHaveBeenCalledOnce();
    vm.pageActive = true;
    loader.mockResolvedValue([{ label: '普通', value: 'Normal' }]);
    await vm.loadTableDisplayOptions(field);
    expect(loader).toHaveBeenCalledTimes(2);
    mocks.access.accessCodes = [];
  });
  it('真实组件排除无权必填字段，并在默认值和转换器回填之后裁剪最终创建载荷', async () => {
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          defaultFormValues: { amount: 600 },
          transformSubmit: (values) => ({
            ...values,
            amount: null,
            forceUpdateFields: ['amount', 'name'],
          }),
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleCreate();
    vm.formState.name = '新合同';
    expect(
      vm.visibleFormFields.map((field: { key: string }) => field.key),
    ).not.toContain('amount');
    expect(
      vm.submittableFormFields.map((field: { key: string }) => field.key),
    ).not.toContain('amount');
    await vm.handleSubmit();
    expect(mocks.post).toHaveBeenCalledWith(
      '/Contract/create',
      expect.objectContaining({ name: '新合同', forceUpdateFields: ['name'] }),
      expect.anything(),
    );
    expect(mocks.post.mock.calls.at(-1)?.[1]).not.toHaveProperty('amount');
  });
  it('真实组件更新保留显式空值，清理转换器恢复的字段和forceUpdateFields', async () => {
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          transformSubmit: (values) => ({
            ...values,
            amount: [],
            forceUpdateFields: ['amount', 'name'],
          }),
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleEdit({
      id: '1',
      name: '原名称',
      amount: 100,
      optimisticLock: 2,
    });
    vm.formState.name = '';
    await vm.handleSubmit();
    const payload = mocks.put.mock.calls.at(-1)?.[1];
    expect(payload).toMatchObject({
      id: '1',
      name: '',
      optimisticLock: 2,
      forceUpdateFields: ['name'],
    });
    expect(payload).not.toHaveProperty('amount');
  });

  it('固定条件、旧排序和查询草稿含受限属性时阻止发送，保留草稿', async () => {
    mocks.route.meta = { fixedQuery: { amount: 100 } };
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config() },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await expect(vm.loadList()).rejects.toThrow('属性');
    expect(
      mocks.get.mock.calls.filter(([path]) => String(path).includes('/list')),
    ).toHaveLength(0);
    wrapper.unmount();
    mocks.route.meta = {};
    const second = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config() },
    });
    await flushPromises();
    const state = setupState(second);
    mocks.get.mockClear();
    state.tableSorterState.field = 'amount';
    state.tableSorterState.order = 'ascend';
    await expect(state.loadList()).rejects.toThrow('属性');
    expect(mocks.get).not.toHaveBeenCalled();
    state.tableSorterState.field = undefined;
    state.tableSorterState.order = undefined;
    state.searchState.amount = 300;
    await expect(state.loadList()).rejects.toThrow('属性');
    expect(mocks.get).not.toHaveBeenCalled();
    expect(state.searchState.amount).toBe(300);
  });

  it('apiService别名通过唯一操作策略加载，前端不按create名字猜路径', async () => {
    const queryLog: unknown[] = [];
    configureDataAttrPolicyLoader(async (query) => {
      queryLog.push(query);
      return {
        version: 1,
        policies: [
          policy(
            'operation' in query ? query.operation : 'contract:合同::操作',
          ),
        ],
      };
    });
    const create = vi.fn().mockResolvedValue({});
    const service = { create };
    ResAuthorize({
      domain: 'contract',
      type: '合同',
      action: '提交专用',
      onlyRequireAuthenticated: true,
    })(service, 'create', { value: create });
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config({ apiService: service }) },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleCreate();
    vm.formState.name = '测试';
    await vm.handleSubmit();
    expect(queryLog).toContainEqual({ operation: 'contract:合同::提交专用' });
    expect(queryLog).not.toContainEqual({
      method: 'POST',
      path: '/Contract/create',
    });
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ amount: expect.anything() }),
    );
  });

  it('列表、导出候选和响应记录排除无权字段；策略失效时立即禁用旧权限', async () => {
    let allowed = true;
    configureDataAttrPolicyLoader(async (query) => {
      const result = policy(
        'operation' in query ? query.operation : 'contract:合同::操作',
      );
      const finance = result.groups[0];
      if (finance) finance.allowed = allowed;
      return { version: 1, policies: [result] };
    });
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config() },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    expect(
      vm.exportableFields.map((field: { key: string }) => field.key),
    ).toContain('amount');
    vm.exportSelectedFieldKeys = ['amount', 'name'];
    allowed = false;
    clearDataAttrPolicies();
    expect(
      vm.visibleTableFields.map((field: { key: string }) => field.key),
    ).not.toContain('amount');
    await flushPromises();
    expect(
      vm.exportableFields.map((field: { key: string }) => field.key),
    ).not.toContain('amount');
    expect(
      vm.selectedExportFields.map((field: { key: string }) => field.key),
    ).not.toContain('amount');
    await vm.loadList();
    expect(vm.dataSource[0]).not.toHaveProperty('amount');
  });
  it('无组策略重复使用缓存，默认值保持原提交行为', async () => {
    const loader = vi.fn(async () => {
      const result = policy();
      result.restricted = false;
      result.groups = [];
      result.nodes = {};
      result.requestRoots = [];
      result.viewRoots = { request: [], response: [] };
      result.responseRoot = null;
      return { version: 1, policies: [result] };
    });
    configureDataAttrPolicyLoader(loader);
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config({ defaultFormValues: { amount: 800 } }) },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleCreate();
    vm.formState.name = '公开记录';
    await vm.handleSubmit();
    expect(mocks.post.mock.calls.at(-1)?.[1]).toMatchObject({
      name: '公开记录',
      amount: 800,
    });
    const count = loader.mock.calls.length;
    await vm.dataAttrAccess.ensure('create');
    await vm.dataAttrAccess.ensure('create');
    expect(loader).toHaveBeenCalledTimes(count);
  });

  it('提交期间撤权保留草稿，不自动重写或重试保存', async () => {
    let finish: ((payload: Record<string, any>) => void) | undefined;
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          transformSubmit: (_values) =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleCreate();
    vm.formState.name = '保留草稿';
    const saving = vm.handleSubmit();
    await flushPromises();
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    configureDataAttrPolicyLoader(async (query) => ({
      version: 1,
      policies: [
        policy('operation' in query ? query.operation : 'contract:合同::操作'),
      ],
    }));
    await flushPromises();
    finish?.({ name: '保留草稿' });
    await saving;
    expect(mocks.post).not.toHaveBeenCalled();
    expect(vm.formState.name).toBe('保留草稿');
    expect(vm.modalOpen).toBe(true);
    expect(vm.submitting).toBe(false);
    errorLog.mockRestore();
  });
  it('受限主键不可被裁剪成更宽的更新，普通名称也不发送', async () => {
    configureDataAttrPolicyLoader(async (query) => {
      const result = policy(
        'operation' in query ? query.operation : 'contract:合同::操作',
      );
      result.nodes.dto?.fields?.push({
        name: 'id',
        wireName: 'id',
        groupIds: ['finance'],
        nodeId: 'value',
      });
      return { version: 1, policies: [result] };
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config() },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleEdit({ id: '1', name: '原名称' });
    vm.formState.name = '新名称';
    await vm.handleSubmit();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(vm.modalOpen).toBe(true);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('id'));
    errorLog.mockRestore();
  });

  it('非表单范围参数无权时整次拒绝，不把范围裁剪后继续更新', async () => {
    configureDataAttrPolicyLoader(async (query) => {
      const result = policy(
        'operation' in query ? query.operation : 'contract:合同::操作',
      );
      result.nodes.dto?.fields?.push({
        name: 'scope',
        wireName: 'scope',
        groupIds: ['finance'],
        nodeId: 'value',
      });
      return { version: 1, policies: [result] };
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          transformSubmit: (values) => ({ ...values, scope: 'ORG_A' }),
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleEdit({ id: '1', name: '原名称' });
    vm.formState.name = '新名称';
    await vm.handleSubmit();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('scope'));
    errorLog.mockRestore();
  });

  it('裁剪后没有业务赋值时阻止空更新，不影响允许服务端默认值的新增', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          fields: [
            { key: 'amount', label: '金额', form: true, required: true },
          ],
          defaultFormValues: { amount: 600 },
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleEdit({ id: '1', amount: 100 });
    await vm.handleSubmit();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      expect.stringContaining('没有可更新'),
    );
    await vm.handleCreate();
    await vm.handleSubmit();
    expect(mocks.post).toHaveBeenCalledWith(
      '/Contract/create',
      {},
      expect.anything(),
    );
    errorLog.mockRestore();
  });
  it('撤权后已打开详情和已有列表的嵌套响应立即重新投影，不展示缓存中的子字段', async () => {
    let allowed = true;
    configureDataAttrPolicyLoader(async (query) => {
      const result = policy(
        'operation' in query ? query.operation : 'contract:合同::操作',
      );
      const finance = result.groups[0];
      if (finance) finance.allowed = allowed;
      result.nodes.dto?.fields?.push({
        name: 'detail',
        wireName: 'detail',
        groupIds: [],
        nodeId: 'nested',
      });
      result.nodes.nested = {
        kind: 'object',
        fields: [
          {
            name: 'amount',
            wireName: 'amount',
            groupIds: ['finance'],
            nodeId: 'value',
          },
          {
            name: 'comment',
            wireName: 'comment',
            groupIds: [],
            nodeId: 'value',
          },
        ],
      };
      return { version: 1, policies: [result] };
    });
    const record = {
      id: '1',
      name: '合同',
      detail: { amount: 500, comment: '公开说明' },
    };
    mocks.get.mockImplementation(async (path: string) => {
      if (path.includes('/list')) return { items: [record], totals: 1 };
      if (path.includes('/retrieve')) return record;
      return [];
    });
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          fields: [
            { key: 'name', label: '名称', form: true, table: true },
            { key: 'detail', label: '详情', type: 'json', table: true },
          ],
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleRetrieve(record);
    expect(vm.visibleActionResultData.detail.amount).toBe(500);
    allowed = false;
    clearDataAttrPolicies();
    expect(vm.visibleDataSource).toEqual([]);
    expect(vm.visibleActionResultData).toBeUndefined();
    await flushPromises();
    expect(vm.visibleDataSource[0].detail).toEqual({ comment: '公开说明' });
    expect(vm.visibleActionResultData.detail).toEqual({ comment: '公开说明' });
  });
});
