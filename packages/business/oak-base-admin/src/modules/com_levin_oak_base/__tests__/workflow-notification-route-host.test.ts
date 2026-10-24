/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 测试替身只模拟公共插槽和事件合同。 */
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';

import { Button, Modal } from 'ant-design-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowNotificationRoutePage from '../views/workflow-notification-route/index.vue';

const api = vi.hoisted(() => ({
  denied: new Set<string>(),
  list: vi.fn(),
  retrieve: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  reload: vi.fn(),
  records: [] as any[],
  states: [] as any[],
}));
vi.mock('../api/workflow-notification-route-service', () => ({
  workflowNotificationRouteService: api,
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({
    hasPermission: (permissions: string[]) =>
      !permissions.some((permission) => api.denied.has(permission)),
  }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
vi.mock('../views/api-module', () => ({
  moduleFetchEnumOptions: async () => [
    { label: '站内', value: 'Station' },
    { label: '飞书', value: 'FeishuWebhook' },
  ],
}));
vi.mock('../views/support-scope-selector.vue', () => ({
  default: defineComponent({
    name: 'SupportScopeSelector',
    props: ['modelValue'],
    emits: ['change'],
    template: '<div />',
  }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/json-editor-field.vue',
  () => ({ default: { template: '<div />' } }),
);
vi.mock(
  '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue',
  () => ({
    default: defineComponent({
      name: 'CrudPage',
      props: ['config'],
      setup(props, { slots, expose }) {
        const state = reactive({ ...props.config.initialQuery });
        expose({ state });
        api.states.push(state);
        return () =>
          h('main', [
            slots['search-field-orgId']?.({ searchState: state }),
            slots['toolbar-extra']?.({
              loadList: api.reload,
              isListOperationVisible: () => true,
            }),
            ...api.records.map((record) =>
              h(
                'section',
                { 'data-row': record.id },
                slots['row-actions']?.({ record, reload: api.reload }),
              ),
            ),
          ]);
      },
    }),
  }),
);
const record = {
  id: 'route-1',
  optimisticLock: 4,
  editable: true,
  eventName: 'TaskCreated',
  channel: 'Station',
  priority: 100,
  forceOverride: false,
  enable: true,
  targetConfig: {},
};
const findButton = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAllComponents(Button).find((button) => button.text() === text);
const crud = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findComponent({ name: 'CrudPage' });
function required<T>(value: T | undefined): T {
  if (!value) throw new Error('测试控件不存在');
  return value;
}
const editor = (wrapper: ReturnType<typeof mount>) =>
  wrapper
    .findAllComponents(Modal)
    .find((modal) => modal.props('title') === '工作流通知路由配置');

describe('通知路由真实公共CRUD接入', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.denied.clear();
    api.states = [];
    api.records = [{ ...record }];
    api.list.mockResolvedValue({ items: [record], totals: 47 });
    api.retrieve.mockResolvedValue({ ...record });
  });

  it('只绑定真实列表，关闭普通增改删和不完整导出，并登记实际字段权限接口', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    const config = crud(wrapper).props('config');
    expect(config).toMatchObject({
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
      allowRetrieve: false,
      allowExport: false,
      queryPermission: ['list'],
    });
    expect(config.dataAttrTargets.list).toEqual({
      method: 'GET',
      path: expect.stringMatching(/\/WorkflowNotificationRoute\/list$/),
    });
    expect(Object.keys(config.apiService)).toEqual(['list']);
    expect(
      config.fields
        .filter((field: any) => field.search)
        .map((field: any) => field.key),
    ).toEqual(['orgId', 'eventName', 'channel']);
    const result = await config.apiService.list({
      pageIndex: 3,
      pageSize: 50,
      eventName: 'TaskProcessed',
      channel: 'Station',
      forged: true,
    });
    expect(api.list).toHaveBeenCalledWith({
      pageIndex: 3,
      pageSize: 50,
      eventName: 'TaskProcessed',
      channel: 'Station',
    });
    expect(result.totals).toBe(47);
    wrapper.unmount();
  });

  it('范围切换重建旧列表并保留其它筛选，重置后不残留旧租户组织', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    const old = crud(wrapper);
    api.states.at(-1).eventName = 'TaskReminder';
    const selector = wrapper.findComponent({ name: 'SupportScopeSelector' });
    selector.vm.$emit('change', {
      id: 'org-1',
      tenantId: 'tenant-1',
      kind: 'org',
      name: '研发',
    });
    await flushPromises();
    expect(old.exists()).toBe(false);
    const fresh = crud(wrapper);
    expect(api.states.at(-1)).toMatchObject({
      orgId: 'org-1',
      eventName: 'TaskReminder',
    });
    await fresh
      .props('config')
      .apiService.list({ ...api.states.at(-1), pageIndex: 2, pageSize: 20 });
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        orgId: 'org-1',
        eventName: 'TaskReminder',
      }),
    );
    api.states.at(-1).orgId = undefined;
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'SupportScopeSelector' })
        .props('modelValue'),
    ).toBeUndefined();
    await required(findButton(wrapper, '新增通知路由')).trigger('click');
    required(editor(wrapper)).vm.$emit('ok');
    await flushPromises();
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: undefined, orgId: undefined }),
    );
    wrapper.unmount();
  });

  it('未知组织不能悄悄退回全部范围，已排除的组织条件不会由旧选择补回', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    wrapper
      .findComponent({ name: 'SupportScopeSelector' })
      .vm.$emit('change', { id: 'org-1', tenantId: 'tenant-1', kind: 'org' });
    await flushPromises();
    const list = crud(wrapper).props('config').apiService.list;
    await expect(list({ orgId: 'org-unselected' })).rejects.toThrow(
      '业务范围已变化',
    );
    expect(api.list).not.toHaveBeenCalled();
    await list({ pageIndex: 1, pageSize: 20 });
    expect(api.list).toHaveBeenCalledWith({
      pageIndex: 1,
      pageSize: 20,
      eventName: undefined,
      channel: undefined,
    });
    wrapper.unmount();
  });

  it('旧范围的在途响应不会恢复到当前列表', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    let resolve!: (value: unknown) => void;
    api.list.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = crud(wrapper)
      .props('config')
      .apiService.list({ pageIndex: 1 });
    wrapper
      .findComponent({ name: 'SupportScopeSelector' })
      .vm.$emit('change', { id: 'org-2', tenantId: 'tenant-2', kind: 'org' });
    await flushPromises();
    resolve({ items: [record], totals: 47 });
    await expect(pending).resolves.toEqual({ items: [], totals: 0 });
    wrapper.unmount();
  });

  it('专用编辑保留读到的版本并刷新公共列表，删除仍需确认', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '编辑')).trigger('click');
    await flushPromises();
    expect(api.retrieve).toHaveBeenCalledWith({ id: 'route-1' });
    required(editor(wrapper)).vm.$emit('ok');
    await flushPromises();
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'route-1', optimisticLock: 4 }),
    );
    expect(api.reload).toHaveBeenCalledTimes(1);
    await required(findButton(wrapper, '删除')).trigger('click');
    expect(api.remove).not.toHaveBeenCalled();
    const confirm = wrapper
      .findAllComponents(Modal)
      .find((modal) => modal.props('title') === '删除通知路由');
    required(confirm).vm.$emit('ok');
    await flushPromises();
    expect(api.remove).toHaveBeenCalledWith({ id: 'route-1' });
    expect(api.reload).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('不可编辑记录和逐方法权限不会因公共行操作插槽而放宽', async () => {
    api.records = [{ ...record, editable: false }];
    api.denied.add('create');
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    expect(findButton(wrapper, '编辑')).toBeUndefined();
    expect(findButton(wrapper, '删除')).toBeUndefined();
    expect(findButton(wrapper, '新增通知路由')).toBeUndefined();
    api.denied.add('list');
    await expect(
      crud(wrapper).props('config').apiService.list(),
    ).resolves.toEqual({ items: [], totals: 0 });
    expect(api.list).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('详情返回不可编辑时不打开写入弹窗', async () => {
    api.retrieve.mockResolvedValue({ ...record, editable: false });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '编辑')).trigger('click');
    await flushPromises();
    expect(required(editor(wrapper)).props('open')).toBe(false);
    wrapper.unmount();
  });
});
