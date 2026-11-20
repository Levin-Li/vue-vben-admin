/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 测试替身只模拟公共插槽和事件合同。 */
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';

import { Button, Collapse, Form, Input, Modal, Select, Switch } from 'ant-design-vue';
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
  definitionList: vi.fn(),
  versionList: vi.fn(),
  versionRetrieve: vi.fn(),
  userInfo: { platformUser: true } as Record<string, unknown>,
  fieldAllowed: true,
  ensure: vi.fn(),
  assertInput: vi.fn(),
  assertCheckpoint: vi.fn(),
}));
vi.mock('@levin/admin-framework/framework-commons/shared/crud-data-attr-access', () => ({
  useCrudDataAttrAccess: () => ({ allowed: () => api.fieldAllowed, ensure: api.ensure, checkpoint: () => 1, assertCheckpoint: api.assertCheckpoint, assertInput: api.assertInput }),
}));
vi.mock('../api/workflow-notification-route-service', () => ({
  workflowNotificationRouteService: api,
}));
vi.mock('../api/workflow-definition-service', () => ({
  workflowDefinitionService: { list: api.definitionList },
}));
vi.mock('../api/workflow-definition-version-service', () => ({
  workflowDefinitionVersionService: {
    list: api.versionList,
    retrieve: api.versionRetrieve,
  },
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
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: api.userInfo }),
  useAccessStore: () => ({ accessCodes: [] }),
}));
vi.mock('../views/api-module', () => ({
  tenantOptionsLoader: async () => [{ label: '甲租户', value: 'tenant-1' }],
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
        expose({ state, reload: api.reload });
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
                [...(props.config.rowActions
                  ?.filter(
                    (action: any) => !action.visible || action.visible(record),
                  )
                  .map((action: any) =>
                    h(
                      Button,
                      {
                        type: 'link',
                        danger: action.danger,
                        onClick: () => action.handler(record),
                      },
                      () => action.label,
                    ),
                  ) ?? []), ...(slots['table-cell-enable']?.({ record }) ?? [])],
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
    .find((modal) => modal.props('title') === '通知渠道配置');

describe('通知路由真实公共CRUD接入', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.denied.clear();
    api.fieldAllowed = true;
    api.ensure.mockResolvedValue({});
    api.assertInput.mockImplementation(() => {});
    api.assertCheckpoint.mockImplementation(() => {});
    api.userInfo = { platformUser: true };
    api.states = [];
    api.records = [{ ...record }];
    api.list.mockResolvedValue({ items: [record], totals: 47 });
    api.retrieve.mockResolvedValue({ ...record });
    api.definitionList.mockResolvedValue({
      items: [
        { id: 'definition-1', name: '请假审批', processKey: 'leave-process' },
      ],
      totals: 1,
    });
    api.versionList.mockResolvedValue({
      items: [
        {
          id: 'version-1',
          versionNo: 1,
          lifecycle: 'Published',
          lowflowDefinition: {
            schemaVersion: 5,
            nodes: [{ id: 'approve-task', name: '主管审批', type: 'userTask' }],
          },
        },
      ],
      totals: 1,
    });
    api.versionRetrieve.mockResolvedValue({
      id: 'version-1',
      lowflowDefinition: {
        schemaVersion: 5,
        nodes: [{ id: 'approve-task', name: '主管审批', type: 'userTask' }],
      },
    });
  });

  it('基本配置有真实表单模型，流程版本和节点从授权目录逐级选择', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    expect(modal.findComponent(Form).props('model')).toMatchObject({
      eventName: 'TaskCreated',
      channel: 'Station',
    });
    const findSelect = (testId: string) =>
      required(
        modal
          .findAllComponents(Select)
          .find((item) => item.attributes('data-testid') === testId),
      );
    const process = findSelect('route-process');
    expect(process.props('showSearch')).toBe(true);
    expect(process.props('options')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '请假审批', value: 'leave-process' }),
      ]),
    );
    process.vm.$emit('update:value', 'leave-process');
    await flushPromises();
    modal.findComponent(Collapse).vm.$emit('update:activeKey', ['advanced']);
    await flushPromises();
    const version = findSelect('route-version');
    expect(version.props('showSearch')).toBe(true);
    expect(version.props('options')).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'version-1' })]),
    );
    version.vm.$emit('update:value', 'version-1');
    await flushPromises();
    expect(findSelect('route-node').props('showSearch')).toBe(true);
    expect(findSelect('route-node').props('options')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '主管审批', value: 'approve-task' }),
      ]),
    );
    wrapper.unmount();
  });

  it('机器人只填写目标名称，保存时自动带入平台逻辑引用', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    const modal = required(editor(wrapper));
    const channel = required(
      modal
        .findAllComponents(Select)
        .find((item) =>
          item
            .props('options')
            ?.some(
              (option) => 'value' in option && option.value === 'FeishuWebhook',
            ),
        ),
    );
    channel.vm.$emit('update:value', 'FeishuWebhook');
    await flushPromises();
    const target = required(
      modal
        .findAllComponents(Input)
        .find((item) =>
          String(item.props('placeholder')).includes('approval-alerts'),
        ),
    );
    target.vm.$emit('update:value', 'ops');
    await flushPromises();
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'FeishuWebhook',
        targetConfig: { configRef: 'platform:ops' },
      }),
    );
    wrapper.unmount();
  });

  it('租户机器人编辑回显目标名称并保持租户作用域', async () => {
    api.retrieve.mockResolvedValue({
      ...record,
      tenantId: 'tenant-1',
      channel: 'FeishuWebhook',
      targetConfig: { configRef: 'tenant:tenant-1:ops' },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '编辑')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    const target = required(
      modal
        .findAllComponents(Input)
        .find((item) =>
          String(item.props('placeholder')).includes('approval-alerts'),
        ),
    );
    expect(target.props('value')).toBe('ops');
    target.vm.$emit('update:value', 'new-ops');
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        targetConfig: { configRef: 'tenant:tenant-1:new-ops' },
      }),
    );
    wrapper.unmount();
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
    ).toEqual(['tenantId', 'orgId', 'eventName', 'channel', 'enable']);
    const tenantField = config.fields.find(
      (field: any) => field.key === 'tenantId',
    );
    expect(tenantField).toMatchObject({
      type: 'select',
      remoteSearch: true,
      visibleForPlatformUser: true,
      table: false,
      form: false,
    });
    await expect(tenantField.loadOptions('甲')).resolves.toEqual([
      { label: '甲租户', value: 'tenant-1' },
    ]);
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
    await config.apiService.list({ enable: 'false' });
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ enable: false }),
    );
    await expect(config.apiService.list({ enable: 'unknown' })).rejects.toThrow(
      '启用状态无效',
    );
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
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
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

  it('允许只选租户查询和创建，详情显示记录原归属', async () => {
    api.retrieve.mockResolvedValue({
      ...record,
      tenantId: 'tenant-1',
      tenantName: '甲租户',
      orgId: 'org-1',
      orgName: '研发',
    });
    const wrapper = mount(WorkflowNotificationRoutePage, {
      attachTo: document.body,
    });
    await flushPromises();
    api.states.at(-1).tenantId = 'tenant-1';
    await crud(wrapper).props('config').apiService.list(api.states.at(-1));
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
    expect(api.list.mock.lastCall?.[0]).not.toHaveProperty('orgId');

    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    const modal = required(editor(wrapper));
    const tenant = modal
      .findAllComponents(Select)
      .find((item) => item.attributes('data-testid') === 'route-form-tenant');
    expect(required(tenant).props('value')).toBe('tenant-1');
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        orgId: undefined,
      }),
    );

    await required(findButton(wrapper, '查看')).trigger('click');
    await flushPromises();
    expect(
      document.body.querySelector('[data-testid=route-tenant]')?.textContent,
    ).toBe('甲租户');
    expect(
      document.body.querySelector('[data-testid=route-org]')?.textContent,
    ).toBe('研发');
    expect(api.update).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('普通租户忽略查询中的租户输入并由服务端确定当前租户', async () => {
    api.userInfo = { tenantId: 'tenant-1', platformUser: false };
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await crud(wrapper).props('config').apiService.list({
      tenantId: 'tenant-other',
      pageIndex: 1,
    });
    expect(api.list.mock.lastCall?.[0]).not.toHaveProperty('tenantId');
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    const modal = required(editor(wrapper));
    expect(modal.find('[data-testid="route-form-tenant"]').exists()).toBe(
      false,
    );
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
      .find((modal) => modal.props('title') === '删除通知渠道');
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
    expect(findButton(wrapper, '新增通知渠道')).toBeUndefined();
    api.denied.add('list');
    await expect(
      crud(wrapper).props('config').apiService.list(),
    ).resolves.toEqual({ items: [], totals: 0 });
    expect(api.list).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('删除为危险色，操作使用稳定展示标识并对缺失可编辑性失败关闭', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    const actions = crud(wrapper).props('config').rowActions;
    expect(actions.map((action: any) => action.displayKey)).toEqual([
      'notification:retrieve', 'notification:update', 'notification:remove',
    ]);
    expect(actions[2].danger).toBe(true);
    expect(actions[1].visible({ ...record, editable: undefined })).toBe(false);
    expect(actions[2].visible({ ...record, editable: undefined })).toBe(false);
    api.userInfo.topSuperAdmin = true;
    expect(actions[1].visible({ ...record, editable: false })).toBe(true);
    expect(actions[2].visible({ ...record, editable: false })).toBe(true);
    wrapper.unmount();
  });
  it('启停检查字段权限并只提交状态和版本，失败保留原值', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    const toggle = required(wrapper.findAllComponents(Switch).find((item) => item.props('checked') === true));
    api.update.mockRejectedValueOnce(new Error('版本冲突'));
    toggle.vm.$emit('change', false);
    await flushPromises();
    expect(api.assertInput).toHaveBeenCalledWith('update', { id: 'route-1', optimisticLock: 4, enable: false });
    expect(api.update).toHaveBeenCalledWith({ id: 'route-1', optimisticLock: 4, enable: false });
    expect(toggle.props('checked')).toBe(true);
    expect(api.reload).not.toHaveBeenCalled();
    api.update.mockResolvedValueOnce(undefined);
    toggle.vm.$emit('change', false);
    await flushPromises();
    expect(api.reload).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    api.fieldAllowed = false;
    const denied = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    expect(denied.findAllComponents(Switch)).toHaveLength(0);
    denied.unmount();
  });
  it('授权在等待期间撤销时不提交启停', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    api.assertCheckpoint.mockImplementation(() => { throw new Error('授权变更'); });
    required(wrapper.findAllComponents(Switch).find((item) => item.props('checked') === true)).vm.$emit('change', false);
    await flushPromises();
    expect(api.update).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('等待授权期间切换业务范围时不提交旧记录', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    let resolvePolicy!: (value: object) => void;
    api.ensure.mockReturnValueOnce(new Promise((resolve) => { resolvePolicy = resolve; }));
    required(wrapper.findAllComponents(Switch).find((item) => item.props('checked') === true)).vm.$emit('change', false);
    wrapper.findComponent({ name: 'SupportScopeSelector' }).vm.$emit('change', { id: 'org-1', tenantId: 'tenant-1', kind: 'org', name: '研发' });
    await flushPromises();
    resolvePolicy({});
    await flushPromises();
    expect(api.update).not.toHaveBeenCalled();
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
