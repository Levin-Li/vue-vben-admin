import type { DataAttrPolicy } from '../../data-attr-policy';
import type { CrudPageConfig } from '../types';

import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from '@vue/test-utils';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';

import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureDataAttrPolicyLoader } from '../../data-attr-policy';
import CrudPage from '../dynamic-crud-page.vue';

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

describe('cRUD 缓存页的前台副作用', () => {
  it('失活时移除全局粘贴监听，激活复用同一实例且不重复订阅', async () => {
    const visible = ref(true);
    const pageConfig = config();
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const Host = defineComponent({
      setup: () => () =>
        h(KeepAlive, null, {
          default: () =>
            visible.value ? h(CrudPage, { config: pageConfig }) : null,
        }),
    });
    const host = shallowMount(Host, {
      global: {
        plugins: [createPinia()],
        config: {
          errorHandler: (error) => {
            throw error;
          },
        },
        stubs: {
          KeepAlive: false,
          DynamicCrudPage: false,
          Page: { template: '<div><slot /></div>' },
          ATable: { inheritAttrs: false, template: '<div />' },
        },
      },
    });
    await flushPromises();
    const child = host.findComponent(CrudPage);
    const vm = setupState(child);
    const pasteCalls = () =>
      add.mock.calls.filter(([type]) => type === 'paste');
    expect(pasteCalls()).toHaveLength(1);
    const listener = pasteCalls()[0]?.[1];
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout');
    const scheduleTimer = vi.spyOn(globalThis, 'setTimeout');
    vm.searchState.name = '保留的筛选条件';
    await nextTick();
    vm.scheduleSingleTextQueryAutoSearch();
    const scheduledTimer = scheduleTimer.mock.results.at(-1)?.value;
    vm.handleListTableTabsPointerDown({
      button: 0,
      clientX: 10,
      clientY: 20,
      preventDefault() {},
    });
    visible.value = false;
    await nextTick();
    expect(remove).toHaveBeenCalledWith('paste', listener);
    expect(clearTimer).toHaveBeenCalledWith(scheduledTimer);
    scheduleTimer.mockClear();
    vm.scheduleSingleTextQueryAutoSearch();
    expect(scheduleTimer).not.toHaveBeenCalled();
    expect(remove.mock.calls.some(([type]) => type === 'pointermove')).toBe(
      true,
    );
    expect(vm.isDraggingListTableTabs).toBe(false);
    expect(vm.pageActive).toBe(false);
    visible.value = true;
    await nextTick();
    expect(pasteCalls()).toHaveLength(2);
    expect(host.findComponent(CrudPage).vm.$.uid).toBe(child.vm.$.uid);
    expect(setupState(host.findComponent(CrudPage)).searchState.name).toBe(
      '保留的筛选条件',
    );
    host.unmount();
    expect(
      remove.mock.calls.filter(
        ([type, value]) => type === 'paste' && value === listener,
      ),
    ).toHaveLength(2);
    add.mockRestore();
    remove.mockRestore();
    clearTimer.mockRestore();
    scheduleTimer.mockRestore();
  });
});
