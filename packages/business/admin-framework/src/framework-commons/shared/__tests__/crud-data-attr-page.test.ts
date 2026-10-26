import type { DataAttrPolicy } from '../../data-attr-policy';
import type { CrudPageConfig } from '../types';

import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResAuthorize } from '../../api-authorize';
import { showApiErrorMessage } from '../../app/api/api-error-message';
import {
  clearDataAttrPolicies,
  configureDataAttrPolicyLoader,
} from '../../data-attr-policy';
import CrudPage from '../dynamic-crud-page.vue';
import PageDisplaySettingsDrawer from '../page-display-settings-drawer.vue';
import UserOrgSelector from '../user-org-selector.vue';

type PolicyQuery = Parameters<
  Parameters<typeof configureDataAttrPolicyLoader>[0]
>[0];

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  request: vi.fn(),
  delete: vi.fn(),
  error: vi.fn(),
  download: vi.fn(),
  warning: vi.fn(),
  setPageKeepAlive: vi.fn(),
  permissionAllowed: true,
  route: {
    path: '/contracts',
    matched: [],
    meta: {} as Record<string, any>,
    query: {},
  },
  user: { userInfo: { id: 'tester' } },
  access: { accessCodes: [] as string[] },
}));
vi.mock('../crud-file-export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../crud-file-export')>()),
  downloadExcelXml: mocks.download,
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
  useRbacAccess: () => ({ hasPermission: () => mocks.permissionAllowed }),
}));
vi.mock('@vben/runtime/stores', () => ({
  getTabKey: (route: { fullPath?: string; path: string }) =>
    route.fullPath || route.path,
  useUserStore: () => mocks.user,
  useAccessStore: () => mocks.access,
  useTabbarStore: () => ({ setPageKeepAlive: mocks.setPageKeepAlive }),
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
  mocks.permissionAllowed = true;
  mocks.user.userInfo = { id: 'tester' };
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
  it('保存失败已由请求层提示时不重复弹错，并保留表单草稿', async () => {
    const failure = new Error('当前账号未归属租户组织，无法签发邀请链接');
    const create = vi.fn(async () => {
      showApiErrorMessage(failure.message, failure);
      throw failure;
    });
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          apiService: { create },
          dataAttrTargets: {
            create: { method: 'POST', path: '/Contract/create' },
          },
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    const exposed = wrapper.vm as unknown as { isFormOpen: () => boolean };
    expect(exposed.isFormOpen()).toBe(false);
    await vm.handleCreate();
    expect(exposed.isFormOpen()).toBe(true);
    vm.formState.name = '保留草稿';
    mocks.error.mockClear();
    await vm.handleSubmit();
    expect(create).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith(
      expect.objectContaining({ content: failure.message }),
    );
    expect(vm.formState.name).toBe('保留草稿');
    expect(exposed.isFormOpen()).toBe(true);
    expect(vm.submitting).toBe(false);
  });

  it('页面 UI 设置点击前不挂载编辑内容，点击后挂载且关闭时销毁', async () => {
    const wrapper = shallowMount(CrudPage, {
      global: {
        plugins: [createPinia()],
        config: {
          errorHandler: (error) => {
            throw error;
          },
        },
        stubs: {
          Page: { template: '<div><slot /></div>' },
          ATable: { inheritAttrs: false, template: '<div />' },
        },
      },
      props: { config: config() },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    expect(wrapper.findComponent(PageDisplaySettingsDrawer).exists()).toBe(
      false,
    );
    vm.pageDisplaySettingsOpen = true;
    await flushPromises();
    expect(wrapper.findComponent(PageDisplaySettingsDrawer).exists()).toBe(
      true,
    );
    expect(wrapper.findComponent(PageDisplaySettingsDrawer).props('open')).toBe(
      true,
    );
    vm.pageDisplaySettingsOpen = false;
    await flushPromises();
    expect(wrapper.findComponent(PageDisplaySettingsDrawer).exists()).toBe(
      false,
    );
  });

  it('默认角色选择器沿用页面模块地址并合并同页相同查询', async () => {
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config({ apiModuleBase: '/custom/V1/api' }) },
    });
    await flushPromises();
    mocks.get.mockClear();
    const loader = setupState(wrapper).getDefaultOptionsLoader({
      type: 'role-select',
    });
    await Promise.all([loader('角色关键词'), loader('角色关键词')]);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith(
      '/custom/V1/api/Role/listUserRoleCode',
      {
        baseURL: '',
        params: {
          codeForKey: false,
          pageIndex: 1,
          pageSize: 500,
          containsName: '角色关键词',
        },
      },
    );
  });

  it('普通用户缺少列表权限时不请求列表策略也不弹内部错误', async () => {
    mocks.permissionAllowed = false;
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config() },
    });
    await flushPromises();
    const vm = setupState(wrapper);

    expect(vm.canQuery).toBe(false);
    expect(
      mocks.get.mock.calls.some(([path]) => String(path).includes('/list')),
    ).toBe(false);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('缓存页失活期间的列表刷新不弹内部权限错误，恢复后仍可读取列表', async () => {
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config() },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    mocks.error.mockClear();
    mocks.get.mockClear();

    vm.pageActive = false;
    await vm.loadList();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();

    vm.pageActive = true;
    await vm.loadList();
    expect(
      mocks.get.mock.calls.some(([path]) => String(path).includes('/list')),
    ).toBe(true);
  });

  it('活动页的旧字段策略失效时重试新策略，不把上下文变化显示给用户', async () => {
    let resolveOldPolicy!: (value: DataAttrPolicy) => void;
    const oldPolicy = new Promise<DataAttrPolicy>((resolve) => {
      resolveOldPolicy = resolve;
    });
    let listPolicyCalls = 0;
    const provider = vi.fn((operation: string) => {
      if (operation === 'list' && ++listPolicyCalls === 1) return oldPolicy;
      return Promise.resolve(policy());
    });
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config({ dataAttrPolicyProvider: provider }) },
    });
    await flushPromises();
    clearDataAttrPolicies();
    await flushPromises();
    resolveOldPolicy(policy());
    await flushPromises();

    expect(listPolicyCalls).toBeGreaterThan(1);
    expect(
      mocks.get.mock.calls.some(([path]) => String(path).includes('/list')),
    ).toBe(true);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(setupState(wrapper).dataSource).toEqual([
      { id: '1', name: '合同甲' },
    ]);
  });

  it('默认隐藏仍保留设置候选，运行时应用字段缺省并尊重显式设置', async () => {
    const field = {
      key: 'tenantId',
      label: '租户',
      form: true,
      table: true,
      search: true,
      defaultHidden: { create: true, query: true, list: true },
      defaultVisibleRoleCodes: [],
    };
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config({ fields: [field] }) },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    expect(
      vm.effectiveFields.some(
        (item: { key: string }) => item.key === 'tenantId',
      ),
    ).toBe(true);
    expect(vm.getPageDisplayField('create', 'tenantId')).toMatchObject({
      hidden: true,
      visibleRoleCodes: [],
    });
    expect(vm.getPageDisplayHeader('tenantId')).toMatchObject({
      visible: { mode: 'hidden' },
      visibleRoleCodes: [],
    });
    vm.pageDisplayConfig.create = {
      fields: [
        { key: 'tenantId', hidden: false, visibleRoleCodes: ['CUSTOM'] },
      ],
    };
    expect(vm.getPageDisplayField('create', 'tenantId')).toMatchObject({
      hidden: false,
      visibleRoleCodes: ['CUSTOM'],
    });
  });

  it('页面显式设置身份区分同路由的模型，迟到编辑不得覆盖后发新增', async () => {
    let finishEdit!: (record: Record<string, any>) => void;
    const loadEditRecord = vi.fn(
      () =>
        new Promise<Record<string, any>>((resolve) => {
          finishEdit = resolve;
        }),
    );
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({ pageDisplaySettingCode: '/models/a', loadEditRecord }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    expect(vm.pageDisplaySettingCode).toBe('/models/a');
    const edit = vm.handleEdit({ id: '1' });
    await vm.handleCreate();
    finishEdit({ id: '1', name: '迟到记录', optimisticLock: 4 });
    await edit;
    expect(vm.editingRecord).toBeNull();
    expect(vm.modalOpen).toBe(true);
    expect(vm.formState.name).not.toBe('迟到记录');
  });

  it('新增上下文失败不开窗，准备默认值保持新增模式并刷新当前策略', async () => {
    const prepareCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error('上下文失败'))
      .mockResolvedValue({ name: '默认名称' });
    const dataAttrPolicyProvider = vi.fn(async () => policy());
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config({ prepareCreate, dataAttrPolicyProvider }) },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleCreate();
    expect(vm.modalOpen).toBe(false);
    dataAttrPolicyProvider.mockClear();
    await vm.handleCreate();
    expect(dataAttrPolicyProvider).toHaveBeenCalledWith('create');
    expect(vm.modalOpen).toBe(true);
    expect(vm.editingRecord).toBeNull();
    expect(vm.formState.name).toBe('默认名称');
  });

  it('编辑加载失败不开窗，完整响应替换列表行并提交编辑专属字段和最新版本', async () => {
    const loadEditRecord = vi
      .fn()
      .mockRejectedValueOnce(new Error('上下文失败'))
      .mockResolvedValue({
        id: '1',
        name: '完整名称',
        editOnly: '编辑专属',
        optimisticLock: 9,
      });
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          loadEditRecord,
          fields: [
            { key: 'name', label: '名称', form: true },
            { key: 'editOnly', label: '编辑专属', form: true },
          ],
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    const row = { id: '1', staleSecret: '旧无权字段', optimisticLock: 1 };
    await vm.handleEdit(row);
    expect(vm.modalOpen).toBe(false);
    await vm.handleEdit(row);
    expect(vm.formState.editOnly).toBe('编辑专属');
    expect(vm.editingRecord).not.toHaveProperty('staleSecret');
    await vm.handleSubmit();
    expect(mocks.put.mock.calls.at(-1)?.[1]).toMatchObject({
      optimisticLock: 9,
      editOnly: '编辑专属',
    });
  });

  it('单独JSON编辑也读取完整记录，失败保持关闭', async () => {
    const field = {
      key: 'config',
      label: '配置',
      type: 'json' as const,
      form: true,
      jsonSchemaEditor: true,
      jsonSchema: { type: 'object' },
    };
    const loadEditRecord = vi
      .fn()
      .mockRejectedValueOnce(new Error('失败'))
      .mockResolvedValue({
        id: '1',
        config: { current: true },
        optimisticLock: 7,
      });
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config({ loadEditRecord, fields: [field] }) },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.handleJsonFieldEdit({ id: '1' }, field);
    expect(vm.modalOpen).toBe(false);
    await vm.handleJsonFieldEdit({ id: '1', staleSecret: '旧字段' }, field);
    expect(loadEditRecord).toHaveBeenCalledTimes(2);
    expect(vm.modalOpen).toBe(true);
    expect(vm.editingRecord).toEqual({
      id: '1',
      config: { current: true },
      optimisticLock: 7,
    });
  });

  it('同路由模型按显式设置身份隔离本地列偏好，静态页面保持原存储键', async () => {
    const fields = [
      { key: 'name', label: '名称', table: true },
      { key: 'other', label: '其它', table: true },
    ];
    const dataAttrPolicyProvider = async () => policy();
    const configuration = (code?: string) =>
      config({ fields, dataAttrPolicyProvider, pageDisplaySettingCode: code });
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: configuration() },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    const legacyKey = vm.tableColumnPreferenceStorageKey;
    expect(legacyKey).toBe('vben:crud-table-columns:/contracts:default');
    await wrapper.setProps({
      config: configuration('/models/local-columns-a'),
    });
    await flushPromises();
    const firstKey = vm.tableColumnPreferenceStorageKey;
    expect(firstKey).not.toBe(legacyKey);
    vm.hiddenTableColumnKeys = ['name'];
    vm.orderedTableColumnKeys = ['other', 'name'];
    vm.saveTableColumnPreference();
    await wrapper.setProps({
      config: configuration('/models/local-columns-b'),
    });
    await flushPromises();
    const secondKey = vm.tableColumnPreferenceStorageKey;
    expect(secondKey).not.toBe(firstKey);
    expect(vm.hiddenTableColumnKeys).toEqual([]);
    vm.hiddenTableColumnKeys = ['other'];
    vm.orderedTableColumnKeys = ['name', 'other'];
    vm.saveTableColumnPreference();
    await wrapper.setProps({
      config: configuration('/models/local-columns-a'),
    });
    await flushPromises();
    expect(vm.hiddenTableColumnKeys).toEqual(['name']);
    expect(vm.orderedTableColumnKeys).toEqual(['other', 'name']);
    await wrapper.setProps({ config: configuration() });
    await flushPromises();
    expect(vm.tableColumnPreferenceStorageKey).toBe(legacyKey);
    window.localStorage.removeItem(firstKey);
    window.localStorage.removeItem(secondKey);
  });

  it('只读启用字段仅展示且不发送更新，原可写快捷开关继续生效', async () => {
    const record = { id: '1', enabled: true, optimisticLock: 2 };
    const update = vi.fn().mockResolvedValue({});
    const list = vi.fn().mockResolvedValue({ items: [record], totals: 1 });
    const dataAttrPolicyProvider = async () => policy();
    const field = {
      key: 'enabled',
      label: '启用',
      type: 'select' as const,
      valueType: 'boolean' as const,
      form: false,
      table: true,
      readOnly: true,
    };
    const Table = defineComponent({
      props: { dataSource: { type: Array, default: () => [] } },
      setup(props, { slots }) {
        return () =>
          h(
            'div',
            props.dataSource?.length
              ? slots.bodyCell?.({
                  column: { key: 'enabled' },
                  record: props.dataSource[0],
                })
              : [],
          );
      },
    });
    const wrapper = shallowMount(CrudPage, {
      global: {
        config: { errorHandler: () => {} },
        renderStubDefaultSlot: true,
        stubs: { ATable: Table },
      },
      props: {
        config: config({
          fields: [field],
          apiService: { list, update },
          dataAttrPolicyProvider,
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    expect(wrapper.findComponent({ name: 'ASwitch' }).exists()).toBe(false);
    expect(wrapper.text()).toContain('启用');
    await vm.updateBooleanEnableField(record, field, false);
    expect(update).not.toHaveBeenCalled();
    expect(record.enabled).toBe(true);
    await wrapper.setProps({
      config: config({
        fields: [{ ...field, readOnly: false }],
        apiService: { list, update },
        dataAttrPolicyProvider,
      }),
    });
    await flushPromises();
    const toggle = wrapper.findComponent({ name: 'ASwitch' });
    expect(toggle.exists()).toBe(true);
    toggle.vm.$emit('change', false);
    await flushPromises();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        enabled: false,
        optimisticLock: 2,
        autoForceUpdateField: false,
      }),
    );
  });

  it('查询停用时通配授权也不请求列表或加载查询策略，仍可新增', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], totals: 0 });
    const dataAttrPolicyProvider = vi.fn(async (_operation: string) =>
      policy(),
    );
    const wrapper = shallowMount(CrudPage, {
      global: {
        config: { errorHandler: () => {} },
        renderStubDefaultSlot: true,
      },
      props: {
        config: config({
          allowQuery: false,
          allowCreate: true,
          apiService: { list },
          dataAttrPolicyProvider,
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    expect(vm.canQuery).toBe(false);
    expect(wrapper.find('.vben-crud-search-actions').exists()).toBe(false);
    await vm.loadList();
    expect(list).not.toHaveBeenCalled();
    expect(
      dataAttrPolicyProvider.mock.calls.some(
        ([operation]) => operation === 'list',
      ),
    ).toBe(false);
    await vm.handleCreate();
    expect(vm.modalOpen).toBe(true);
    expect(dataAttrPolicyProvider).toHaveBeenCalledWith('create');
  });

  it('导出等待期间修改查询和排序时后续页保留开始时的条件快照', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], totals: 0 });
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          apiService: { list },
          dataAttrPolicyProvider: async () => policy(),
          fields: [
            {
              key: 'name',
              label: '名称',
              search: true,
              table: true,
              sortable: true,
            },
          ],
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    vm.searchState.name = '原条件';
    vm.tableSorterState.field = 'name';
    vm.tableSorterState.order = 'ascend';
    let finishFirstPage: (result: {
      items: Array<{ id: string; name: string }>;
      totals: number;
    }) => void = () => {
      throw new Error('首页请求尚未发出');
    };
    list.mockClear();
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirstPage = resolve;
        }),
    );
    list.mockResolvedValueOnce({ items: [], totals: 2000 });
    const exporting = vm.fetchExportRecords();
    await flushPromises();
    const initialParams = { ...list.mock.calls[0]?.[0] };
    expect(initialParams).toMatchObject({
      name: '原条件',
      pageIndex: 1,
      pageSize: 2000,
    });
    vm.searchState.name = '新条件';
    vm.tableSorterState.order = 'descend';
    finishFirstPage({
      items: Array.from({ length: 2000 }, (_, index) => ({
        id: String(index),
        name: '原条件记录',
      })),
      totals: 2000,
    });
    expect(await exporting).toHaveLength(2000);
    expect(list.mock.calls[1]?.[0]).toEqual({ ...initialParams, pageIndex: 2 });
    expect(vm.searchState.name).toBe('新条件');
    expect(vm.tableSorterState.order).toBe('descend');
  });

  it('导出末次空页等待期间策略失效时拒绝下载已读取记录', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], totals: 0 });
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          apiService: { list },
          dataAttrPolicyProvider: async () => policy(),
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    vm.exportSelectedFieldKeys = ['name'];
    expect(vm.selectedExportFields).toHaveLength(1);
    let finishEmptyPage: (result: {
      items: never[];
      totals: number;
    }) => void = () => {
      throw new Error('末页请求尚未发出');
    };
    list.mockClear();
    list.mockResolvedValueOnce({
      items: Array.from({ length: 2000 }, (_, index) => ({
        id: String(index),
        name: '已读取记录',
      })),
      totals: 2000,
    });
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishEmptyPage = resolve;
        }),
    );
    const exporting = vm.handleExportConfirm();
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(2);
    clearDataAttrPolicies();
    finishEmptyPage({ items: [], totals: 2000 });
    await exporting;
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('导出失败');
    expect(vm.exporting).toBe(false);
  });

  it('导出复用列表服务，显式路径保持HTTP请求', async () => {
    const list = vi
      .fn()
      .mockResolvedValue({ items: [{ id: '1', name: '服务记录' }], totals: 1 });
    const dataAttrPolicyProvider = vi.fn(async () => policy());
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({ apiService: { list }, dataAttrPolicyProvider }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    expect(vm.dataSource[0]?.name).toBe('服务记录');
    list.mockClear();
    expect(await vm.fetchExportRecords()).toEqual([
      { id: '1', name: '服务记录' },
    ]);
    expect(list).toHaveBeenCalledOnce();
    await wrapper.setProps({
      config: config({
        apiService: { list },
        dataAttrPolicyProvider,
        listPath: '/Contract/custom-list',
      }),
    });
    await flushPromises();
    list.mockClear();
    mocks.get.mockClear();
    await vm.fetchExportRecords();
    expect(list).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledWith(
      '/Contract/custom-list',
      expect.anything(),
    );
  });

  it('自定义删除收到第三参数完整记录，默认删除请求仍只传主键', async () => {
    const remove = vi.fn().mockResolvedValue({});
    const dataAttrPolicyProvider = vi.fn(async () => policy());
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: {
        config: config({
          apiService: { delete: remove },
          dataAttrPolicyProvider,
        }),
      },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    const record = { id: '1', optimisticLock: 8, name: '记录' };
    await vm.handleDelete(record);
    expect(remove).toHaveBeenCalledWith({ id: '1' }, undefined, record);
    await wrapper.setProps({ config: config({ dataAttrPolicyProvider }) });
    await flushPromises();
    await vm.handleDelete(record);
    expect(mocks.delete).toHaveBeenCalledWith(
      '/Contract/delete',
      expect.objectContaining({ params: { id: '1' } }),
    );
  });

  it('禁用批量接口的策略失败时不打开导入表单', async () => {
    const batchCreate = vi.fn();
    const apiService = { batchCreate };
    ResAuthorize({ domain: 'contract', type: '合同', action: '批量新增' })(
      apiService,
      'batchCreate',
      { value: batchCreate },
    );
    const loader = vi.fn(async (query: PolicyQuery) => {
      if ('operation' in query && query.operation.endsWith('批量新增'))
        throw new Error('请求参数异常');
      const result = policy('operation' in query ? query.operation : '');
      result.restricted = false;
      return { version: 1, policies: [result] };
    });
    configureDataAttrPolicyLoader(loader);
    const wrapper = shallowMount(CrudPage, {
      global: {
        config: { errorHandler: () => {} },
        renderStubDefaultSlot: true,
      },
      props: { config: config({ apiService }) },
    });
    await flushPromises();
    expect(
      loader.mock.calls.some(
        ([query]) =>
          'operation' in query && query.operation.endsWith('批量新增'),
      ),
    ).toBe(false);

    const state = setupState(wrapper);
    await state.openImportModal();

    expect(state.importModalOpen).toBe(false);
    expect(mocks.error).toHaveBeenCalled();
    expect(batchCreate).not.toHaveBeenCalled();
  });

  it('查询组织字段通过通用选择器回填组织 ID', async () => {
    Object.assign(mocks.user.userInfo, { admin: true, roleList: ['R_ADMIN'] });
    configureDataAttrPolicyLoader(async (query) => {
      const result = policy(
        'operation' in query ? query.operation : 'contract:合同::操作',
      );
      result.restricted = false;
      result.groups = [];
      result.nodes = {};
      result.requestRoots = [];
      result.viewRoots = { request: [], response: [] };
      result.responseRoot = null;
      return { version: 1, policies: [result] };
    });
    const wrapper = shallowMount(CrudPage, {
      global: {
        config: { errorHandler: () => {} },
        renderStubDefaultSlot: true,
      },
      props: {
        config: config({
          fields: [
            {
              key: 'orgId',
              label: '所属组织',
              type: 'org-tree-select',
              search: true,
              form: true,
            },
          ],
        }),
      },
    });
    await flushPromises();

    expect(
      setupState(wrapper).searchFields.map(
        (field: { key: string }) => field.key,
      ),
    ).toContain('orgId');
    const selector = wrapper.findComponent(UserOrgSelector);
    expect(selector.exists()).toBe(true);
    expect(selector.props('selectableTypes')).toEqual(['org']);
    expect(selector.props('valueMode')).toBe('id');
    selector.vm.$emit('update:modelValue', 'org-2');
    const state = setupState(wrapper);
    expect(state.searchState.orgId).toBe('org-2');

    await state.handleCreate();
    await flushPromises();
    expect(
      state.visibleFormFields.map((field: { key: string }) => field.key),
    ).toContain('orgId');
    state.updateFormFieldInput(state.visibleFormFields[0], 'org-3');
    expect(state.formState.orgId).toBe('org-3');

    await state.handleEdit({ id: 'record-1', orgId: 'org-1' });
    await flushPromises();
    expect(state.formState.orgId).toBe('org-1');
  });

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

  it('固定条件和查询草稿含受限属性时阻止发送，旧排序不携带受限字段', async () => {
    mocks.route.meta = { fixedQuery: { amount: 100 } };
    const wrapper = shallowMount(CrudPage, {
      global: { config: { errorHandler: () => {} } },
      props: { config: config() },
    });
    await flushPromises();
    const vm = setupState(wrapper);
    await vm.loadList();
    expect(vm.listError).toContain('属性');
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('属性'));
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
    await state.loadList();
    // 金额列默认不可排序，遗留状态不进入请求；受限属性的查询草稿仍需拦截。
    expect(state.listError).toBe('');
    expect(mocks.get).toHaveBeenCalledWith(
      '/Contract/list',
      expect.not.objectContaining({ orderBy: 'amount' }),
    );
    state.tableSorterState.field = undefined;
    state.tableSorterState.order = undefined;
    state.searchState.amount = 300;
    mocks.get.mockClear();
    await state.loadList();
    expect(state.listError).toContain('属性');
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

// 通过真实组件验证请求与错误边界，默认总数分页保持原有协议。
describe('标准 CRUD 游标与默认分页兼容', () => {
  async function mountList(overrides: Partial<CrudPageConfig> = {}) {
    configureDataAttrPolicyLoader(async () => {
      const result = policy();
      result.restricted = false;
      result.groups = [];
      result.nodes = {};
      result.requestRoots = [];
      result.viewRoots = { request: [], response: [] };
      result.responseRoot = null;
      return { version: 1, policies: [result] };
    });
    const wrapper = shallowMount(CrudPage, {
      global: {
        config: { errorHandler: () => {} },
        renderStubDefaultSlot: true,
      },
      props: {
        config: config({
          fields: [{ key: 'name', label: '名称', table: true, search: true }],
          dataAttrTargets: { list: { method: 'GET', path: '/Contract/list' } },
          ...overrides,
        }),
      },
    });
    await flushPromises();
    return wrapper;
  }
  it('游标使用真实 size/cursor 并能回首页，默认模式保留 pageIndex/pageSize/totals', async () => {
    const list = vi.fn().mockResolvedValue({
      items: [{ id: '1' }],
      hasMore: true,
      nextCursor: 'next:20',
    });
    const wrapper = await mountList({
      paginationMode: 'cursor',
      defaultQuery: { pageSize: 20 },
      apiService: { list },
    });
    expect(list.mock.calls[0]?.[0]).toMatchObject({ size: 20 });
    expect(list.mock.calls[0]?.[0]).not.toHaveProperty('pageIndex');
    expect(list.mock.calls[0]?.[0]).not.toHaveProperty('pageSize');
    setupState(wrapper).changeCursorPage('next');
    await flushPromises();
    expect(list.mock.calls[1]?.[0]).toMatchObject({
      size: 20,
      cursor: 'next:20',
    });
    setupState(wrapper).loadSearchFromFirstPage();
    await flushPromises();
    expect(list.mock.calls[2]?.[0]).not.toHaveProperty('cursor');
    wrapper.unmount();
    const normalList = vi.fn().mockResolvedValue({ items: [], totals: 13 });
    const normal = await mountList({
      apiService: { list: normalList },
      defaultQuery: { pageSize: 20 },
    });
    expect(normalList.mock.calls[0]?.[0]).toMatchObject({
      pageIndex: 1,
      pageSize: 20,
    });
    expect(setupState(normal).pagination.total).toBe(13);
  });
  it('多列表分别保留真实游标，切换时不串表', async () => {
    const list = vi
      .fn()
      .mockResolvedValue({ items: [], hasMore: true, nextCursor: 'next:20' });
    const wrapper = await mountList({
      paginationMode: 'cursor',
      listTables: [{ key: 'a' }, { key: 'b' }],
      apiService: { list },
    });
    const vm = setupState(wrapper);
    vm.changeCursorPage('next');
    await flushPromises();
    expect(list.mock.calls.at(-1)?.[0].cursor).toBe('next:20');
    vm.handleListTableChange('b');
    await flushPromises();
    expect(list.mock.calls.at(-1)?.[0]).not.toHaveProperty('cursor');
    vm.handleListTableChange('a');
    await flushPromises();
    expect(list.mock.calls.at(-1)?.[0].cursor).toBe('next:20');
  });

  it('初始条件可清空，重置恢复但不请求，缺少下一游标不能前进', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], hasMore: true });
    const wrapper = await mountList({
      paginationMode: 'cursor',
      initialQuery: { name: '初始名称' },
      apiService: { list },
    });
    const vm = setupState(wrapper);
    expect(list.mock.calls[0]?.[0]).toMatchObject({ name: '初始名称' });
    vm.searchState.name = '';
    await vm.loadList();
    expect(list.mock.calls.at(-1)?.[0].name).not.toBe('初始名称');
    const count = list.mock.calls.length;
    vm.resetSearch();
    await flushPromises();
    expect(vm.searchState.name).toBe('初始名称');
    expect(list).toHaveBeenCalledTimes(count);
    vm.changeCursorPage('next');
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(count);
  });

  it('错误清理旧列表，迟到及卸载响应不可恢复数据', async () => {
    const list = vi
      .fn()
      .mockResolvedValue({ items: [{ id: 'old' }], hasMore: false });
    const wrapper = await mountList({
      paginationMode: 'cursor',
      apiService: { list },
    });
    let finishOld!: (value: unknown) => void;
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    const oldRequest = (wrapper.vm as any).reload();
    await flushPromises();
    list.mockRejectedValueOnce(new Error('真实列表错误'));
    await (wrapper.vm as any).reload();
    expect(setupState(wrapper).dataSource).toEqual([]);
    expect(setupState(wrapper).listError).toBe('真实列表错误');
    finishOld({ items: [{ id: 'late' }] });
    await oldRequest;
    expect(setupState(wrapper).dataSource).toEqual([]);
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    const lastRequest = (wrapper.vm as any).reload();
    await flushPromises();
    const vm = setupState(wrapper);
    wrapper.unmount();
    finishOld({ items: [{ id: 'unmounted' }] });
    await lastRequest;
    expect(vm.dataSource).toEqual([]);
  });
});
