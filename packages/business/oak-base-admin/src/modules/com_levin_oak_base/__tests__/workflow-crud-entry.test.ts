import type { WorkflowBusinessType } from '@levin/bpm-designer';

import { flushPromises, mount } from '@vue/test-utils';
import { h, reactive } from 'vue';

import { Select } from 'ant-design-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CrudPage from '../views/crud-page.vue';
import WorkflowCrudEntry from '../views/workflow-crud-entry.vue';
import {
  workflowCrudContracts,
  workflowCrudReference,
} from '../views/workflow-crud-resource';

const state = vi.hoisted(() => ({
  actor: {} as Record<string, unknown>,
  access: { accessToken: 'token', accessCodes: [] as string[] },
  catalog: vi.fn(),
  permission: vi.fn(),
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({
    get userInfo() {
      return state.actor;
    },
  }),
  useAccessStore: () => state.access,
}));
vi.mock('@levin/admin-framework/framework-commons/data-attr-policy', () => ({
  isDataAttrPolicyReady: () => true,
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: state.permission }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({ buildApiMethodPermissions: (_: unknown, name: string) => [name] }),
);
vi.mock('../api/workflow-runtime-service', () => ({
  workflowRuntimeService: { catalog: state.catalog },
}));
vi.mock('../api/session-directories', () => ({
  getSessionWorkflowCatalog: state.catalog,
}));
vi.mock('../views/api-module', () => ({
  OAK_BASE_API_MODULE: '/com.levin.oak.base/V1/api',
  moduleExportTemplateService: {},
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue',
  () => ({
    default: {
      props: ['config'],
      template:
        '<section><slot name="row-actions" :record="{ id: \'a1\', tenantId: \'tenant\', orgId: \'org\' }" :reload="() => {}" /><slot name="form-field-test" :disabled="true" /></section>',
    },
  }),
);
vi.mock('@levin/bpm-runtime-ui', () => ({
  WorkflowBusinessPanel: {
    name: 'WorkflowBusinessPanel',
    props: [
      'businessReference',
      'contractVersion',
      'showEligibility',
      'showHistory',
      'canStart',
      'canRetry',
    ],
    emits: ['started'],
    template: '<div>当前行流程面板</div>',
  },
}));

const capability = (businessType: string, contractVersion = 'readonly-3') =>
  ({
    businessType,
    contractVersion,
    title: '业务条件与授权审批',
    fields: {},
    defaultBinding: { identityField: 'id', titleField: 'title' },
  }) satisfies WorkflowBusinessType;
const record = { id: 'a1', tenantId: 'tenant', orgId: 'org' };
const reload = vi.fn();
function mountEntry(apiBase = '/Article', row = record) {
  return mount(WorkflowCrudEntry, {
    props: {
      config: {
        title: '业务台账',
        apiBase,
        fields: [],
        apiService: { retrieve: vi.fn() },
      },
    },
    slots: {
      default: ({ canOpen, open, supported }: any) =>
        h(
          'button',
          {
            disabled: !canOpen(row),
            onClick: () => open(row, reload),
          },
          supported ? '业务流程' : '不支持',
        ),
    },
  });
}

describe('原业务页通用流程入口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actor = reactive({ id: 'actor', tenantId: 'tenant' });
    state.access = reactive({ accessToken: 'token', accessCodes: [] });
    state.permission.mockReturnValue(true);
    state.catalog.mockResolvedValue([capability('Article')]);
  });

  it('目录映射支持专用User/EContract和同名已登记资源，未知资源和专用样例不重复接入', () => {
    const catalog = [
      'Article',
      'ChannelPartner',
      'SupplierPartner',
      'user-state',
      'electronic-contract',
    ].map((type) => capability(type));
    for (const resource of [
      'Article',
      'ChannelPartner',
      'SupplierPartner',
      'User',
      'EContract',
    ]) {
      expect(workflowCrudContracts(`/${resource}`, catalog)).toHaveLength(1);
    }
    expect(workflowCrudContracts('/Tenant', catalog)).toEqual([]);
    expect(
      workflowCrudContracts('/WorkflowRequest', [
        capability('workflow-request'),
      ]),
    ).toEqual([]);
    expect(workflowCrudContracts('/Article/list', catalog)).toEqual([]);
  });

  it('公共CRUD原页保留既有具名扩展并追加业务流程行入口', async () => {
    const wrapper = mount(CrudPage, {
      props: {
        config: {
          apiBase: '/Article',
          title: '资讯',
          fields: [],
          apiService: { retrieve: vi.fn() },
        },
      },
      slots: {
        'row-actions': ({ record }: any) => h('span', `既有操作:${record.id}`),
        'form-field-test': ({ disabled }: any) =>
          h('span', `既有表单:${disabled}`),
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('既有操作:a1');
    expect(wrapper.text()).toContain('既有表单:true');
    const trigger = wrapper
      .findAll('button')
      .find((button) => button.text() === '业务流程');
    expect(trigger).toBeDefined();
    if (!trigger) throw new Error('缺少业务流程行操作');
    await trigger.trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowBusinessPanel' })
        .props('businessReference').businessId,
    ).toBe('a1');
    wrapper.unmount();
  });

  it('普通主体仅补本人租户，平台主体缺行归属或跨租户引用时隐藏入口', () => {
    expect(
      workflowCrudReference(
        { id: 'a1', orgId: 'org' },
        'id',
        'Article',
        state.actor,
      ),
    ).toEqual({
      businessId: 'a1',
      businessType: 'Article',
      tenantId: 'tenant',
      orgId: 'org',
    });
    expect(
      workflowCrudReference(
        { ...record, tenantId: 'other' },
        'id',
        'Article',
        state.actor,
      ),
    ).toBeUndefined();
    expect(
      workflowCrudReference({ id: 'a1', orgId: 'org' }, 'id', 'Article', {
        superAdmin: true,
      }),
    ).toBeUndefined();
    expect(
      workflowCrudReference(
        { ...record, orgId: '' },
        'id',
        'Article',
        state.actor,
      ),
    ).toBeUndefined();
  });

  it('按真实行引用打开固定契约面板，操作后刷新原列表，多契约默认最新并可选择', async () => {
    state.catalog.mockResolvedValue([
      capability('Article', 'readonly-1'),
      capability('Article', 'readonly-3'),
    ]);
    const wrapper = mountEntry();
    await flushPromises();
    await wrapper.find('button').trigger('click');
    await flushPromises();
    const panel = wrapper.findComponent({ name: 'WorkflowBusinessPanel' });
    expect(panel.props('businessReference')).toEqual({
      businessId: 'a1',
      businessType: 'Article',
      tenantId: 'tenant',
      orgId: 'org',
      contractVersion: 'readonly-3',
    });
    expect(panel.props('showHistory')).toBe(true);
    panel.vm.$emit('started', {});
    await flushPromises();
    expect(reload).toHaveBeenCalledOnce();
    const selector = wrapper.findComponent(Select);
    expect(selector.props('options')?.[0]?.label).toContain(
      '业务条件与授权审批',
    );
    selector.vm.$emit('update:value', 'readonly-1');
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowBusinessPanel' })
        .props('businessReference').contractVersion,
    ).toBe('readonly-1');
    wrapper.unmount();
  });

  it('历史与发起分别消费当前权限；撤权清除已打开的业务面板', async () => {
    state.permission.mockImplementation(
      ([method]: string[]) => method !== 'start' && method !== 'eligibility',
    );
    const wrapper = mountEntry();
    await flushPromises();
    await wrapper.find('button').trigger('click');
    await flushPromises();
    const panel = wrapper.findComponent({ name: 'WorkflowBusinessPanel' });
    expect(panel.props('showHistory')).toBe(true);
    expect(panel.props('showEligibility')).toBe(false);
    expect(panel.props('canStart')).toBe(false);
    state.permission.mockReturnValue(false);
    state.access.accessCodes = ['revoked'];
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'WorkflowBusinessPanel' }).exists(),
    ).toBe(false);
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('未知资源不显示入口；切换主体丢弃迟到的旧目录响应', async () => {
    let resolve!: (value: WorkflowBusinessType[]) => void;
    state.catalog.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const wrapper = mountEntry('/Tenant');
    state.actor.id = 'other-actor';
    state.catalog.mockResolvedValue([]);
    await flushPromises();
    resolve([capability('Tenant')]);
    await flushPromises();
    expect(wrapper.text()).not.toContain('业务流程');
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
});
