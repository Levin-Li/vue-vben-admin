/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 测试替身只模拟公共插槽和事件合同。 */
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';

import { Button, Collapse, Form, Modal, Select, Switch } from 'ant-design-vue';
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
  robotGroupCandidates: vi.fn(),
  authorizedOrgTree: vi.fn(),
  tenantOptions: vi.fn(),
  userInfo: { platformUser: true } as Record<string, unknown>,
  fieldAllowed: true,
  ensure: vi.fn(),
  assertInput: vi.fn(),
  assertCheckpoint: vi.fn(),
  assertValueAssignment: vi.fn(),
  deniedFields: new Set<string>(),
  displayFields: new Map<string, any>(),
  displayGroups: new Map<string, any>(),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-data-attr-access',
  () => ({
    useCrudDataAttrAccess: () => ({
      allowed: (_operation: string, _direction: string, field: string) =>
        api.fieldAllowed && !api.deniedFields.has(field),
      ensure: api.ensure,
      checkpoint: () => 1,
      assertCheckpoint: api.assertCheckpoint,
      assertInput: api.assertInput,
      assertValueAssignment: api.assertValueAssignment,
      pruneOutput: (_operation: string, value: unknown) => value,
      pruneInput: (_operation: string, value: unknown) => value,
    }),
  }),
);
vi.mock('../api/workflow-notification-route-service', () => ({
  workflowNotificationRouteService: api,
}));
vi.mock('../api/tenant-service', () => ({ tenantService: { kind: 'tenant' } }));
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
    buildApiMethodPermissions: (service: any, method: string) => [
      service?.kind === 'tenant' ? 'tenant-list' : method,
    ],
  }),
);
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: api.userInfo }),
  useAccessStore: () => ({ accessCodes: [] }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/app/api/rbac-service',
  () => ({
    rbacService: {
      fetchAuthorizedOrgTreeByTenant: api.authorizedOrgTree,
      fetchAuthorizedOrgTree: api.authorizedOrgTree,
    },
  }),
);
vi.mock('../views/api-module', () => ({
  tenantOptionsLoader: api.tenantOptions,
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
        expose({
          state,
          reload: api.reload,
          registerExternalFormElements: vi.fn(),
          getExternalFormDisplayField: (
            view: string,
            _formId: string,
            key: string,
          ) => api.displayFields.get(`${view}:${key}`),
          getExternalFormDisplayGroup: (view: string, key: string) =>
            api.displayGroups.get(`${view}:${key}`),
        });
        api.states.push(state);
        return () =>
          h('main', [
            slots['search-field-orgId']?.({ searchState: state }),
            slots['toolbar-extra']?.({
              loadList: api.reload,
              isListOperationVisible: () => true,
            }),
            ...api.records.map((record) =>
              h('section', { 'data-row': record.id }, [
                ...(props.config.rowActions
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
                  ) ?? []),
                ...(slots['table-cell-enable']?.({ record }) ?? []),
              ]),
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
    api.robotGroupCandidates.mockResolvedValue([
      { id: 'group-1', name: '审批群', channel: 'FeishuWebhook' },
    ]);
    api.tenantOptions.mockResolvedValue([
      { label: '甲租户', value: 'tenant-1' },
    ]);
    api.authorizedOrgTree.mockResolvedValue([
      { id: 'org-1', name: '授权组织', tenantId: 'tenant-1' },
    ]);
    api.denied.clear();
    api.fieldAllowed = true;
    api.deniedFields.clear();
    api.displayFields.clear();
    api.displayGroups.clear();
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

  it('新增表单不显示也不提交无权或按表单设置隐藏的字段', async () => {
    api.deniedFields.add('remark');
    api.displayFields.set('create:processKey', { hidden: true });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    const labels = modal
      .findAllComponents(Form.Item)
      .map((item) => item.props('label'));
    expect(labels).not.toContain('适用流程定义');
    expect(labels).not.toContain('备注');
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.create).toHaveBeenCalledOnce();
    expect(api.create.mock.calls[0]?.[0]).not.toHaveProperty('remark');
    expect(api.create.mock.calls[0]?.[0]).not.toHaveProperty('processKey');
    wrapper.unmount();
  });

  it('专用表单应用自己的标题和禁用设置', async () => {
    api.displayFields.set('create:eventName', {
      label: '触发时机',
      disabled: true,
      order: 5,
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    expect(
      modal.findAllComponents(Form.Item).map((item) => item.props('label')),
    ).toContain('触发时机');
    const event = modal
      .findAllComponents(Select)
      .find((item) =>
        item
          .props('options')
          ?.some(
            (option) => 'value' in option && option.value === 'TaskCreated',
          ),
      );
    expect(required(event).props('disabled')).toBe(true);
    wrapper.unmount();
  });

  it('新增表单按字段类型应用配置的默认值', async () => {
    api.displayFields.set('create:eventName', {
      defaultValue: { value: 'TaskProcessed' },
    });
    api.displayFields.set('create:priority', { defaultValue: { value: 32 } });
    api.displayFields.set('create:remark', {
      defaultValue: { value: '默认备注' },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    expect(
      required(editor(wrapper)).findComponent(Form).props('model'),
    ).toMatchObject({
      eventName: 'TaskProcessed',
      priority: 32,
      remark: '默认备注',
    });
    wrapper.unmount();
  });

  it('展示设置文本中的整数、布尔和 JSON 默认值按类型安全应用', async () => {
    api.displayFields.set('create:priority', { defaultValue: { value: '37' } });
    api.displayFields.set('create:forceOverride', {
      defaultValue: { value: 'true' },
    });
    api.displayFields.set('create:matchCondition', {
      defaultValue: { value: '{"kind":"safe"}' },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    expect(modal.findComponent(Form).props('model')).toMatchObject({
      priority: 37,
      forceOverride: true,
    });
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ matchCondition: { kind: 'safe' } }),
    );
    wrapper.unmount();
  });

  it('配置分组和排序只影响各自区域，基础字段保持在高级折叠区之外', async () => {
    api.displayGroups.set('create:review', {
      key: 'review',
      title: '验收分组',
      order: 1,
    });
    api.displayFields.set('create:eventName', {
      layoutGroup: 'review',
      order: 2,
    });
    api.displayFields.set('create:channel', {
      layoutGroup: 'review',
      order: 1,
    });
    api.displayFields.set('create:nodeKey', {
      layoutGroup: 'review',
      order: 1,
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    modal.findComponent(Collapse).vm.$emit('update:activeKey', ['advanced']);
    await flushPromises();
    const items = modal.findAllComponents(Form.Item);
    const field = (label: string) =>
      required(items.find((item) => item.props('label') === label));
    // 排序必须改变 DOM 顺序，让键盘焦点与视觉顺序一致。
    expect(
      field('通知方式').element.compareDocumentPosition(
        field('发生事件').element,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(field('通知方式').element.closest('.ant-collapse')).toBeNull();
    expect(field('适用节点').element.closest('.ant-collapse')).not.toBeNull();
    expect(document.body.textContent?.match(/验收分组/g)).toHaveLength(2);
    wrapper.unmount();
  });

  it('级联默认值只使用授权候选，且逐级加载流程、版本和节点', async () => {
    api.displayFields.set('create:processKey', {
      defaultValue: { value: 'leave-process' },
    });
    api.displayFields.set('create:workflowDefinitionVersionId', {
      defaultValue: { value: 'version-1' },
    });
    api.displayFields.set('create:nodeKey', {
      defaultValue: { value: 'approve-task' },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    await flushPromises();
    expect(
      required(editor(wrapper)).findComponent(Form).props('model'),
    ).toMatchObject({
      processKey: 'leave-process',
      workflowDefinitionVersionId: 'version-1',
      nodeKey: 'approve-task',
    });
    wrapper.unmount();
  });

  it('状态图仅列出已配置对应生命周期通知的节点并支持默认值', async () => {
    api.versionRetrieve.mockResolvedValue({
      id: 'version-1',
      lowflowDefinition: {
        schemaVersion: 4,
        nodes: [
          { id: 'draft', name: '草稿' },
          {
            id: 'review',
            name: '审批',
            notifications: [{ event: 'NodeEntered' }],
          },
          {
            id: 'done',
            name: '完成',
            terminal: true,
            notifications: [{ event: 'NodeCompleted' }],
          },
        ],
      },
    });
    api.displayFields.set('create:processKey', {
      defaultValue: { value: 'leave-process' },
    });
    api.displayFields.set('create:eventName', {
      defaultValue: { value: 'NodeEntered' },
    });
    api.displayFields.set('create:workflowDefinitionVersionId', {
      defaultValue: { value: 'version-1' },
    });
    api.displayFields.set('create:nodeKey', {
      defaultValue: { value: 'review' },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    await flushPromises();
    const modal = required(editor(wrapper));
    modal.findComponent(Collapse).vm.$emit('update:activeKey', ['advanced']);
    await flushPromises();
    const select = required(
      modal
        .findAllComponents(Select)
        .find((item) => item.attributes('data-testid') === 'route-node'),
    );
    expect(select.props('options')).toEqual([
      { label: '审批', value: 'review' },
    ]);
    expect(select.props('value')).toBe('review');
    const event = required(
      modal
        .findAllComponents(Select)
        .find((item) =>
          item
            .props('options')
            ?.some(
              (option) => 'value' in option && option.value === 'NodeCompleted',
            ),
        ),
    );
    event.vm.$emit('update:value', 'NodeCompleted');
    event.vm.$emit('change', 'NodeCompleted');
    await flushPromises();
    expect(select.props('value')).toBeUndefined();
    expect(select.props('options')).toEqual([{ label: '完成', value: 'done' }]);
    event.vm.$emit('update:value', 'TaskCreated');
    event.vm.$emit('change', 'TaskCreated');
    await flushPromises();
    expect(select.props('options')).toEqual([]);
    wrapper.unmount();
  });

  it('历史节点进入事件编辑时保持事件与节点，不会被默认任务事件覆盖', async () => {
    const historical = {
      ...record,
      eventName: 'NodeEntered',
      processKey: 'leave-process',
      workflowDefinitionVersionId: 'version-1',
      nodeKey: 'review',
    };
    api.records = [historical];
    api.retrieve.mockResolvedValue(historical);
    api.versionRetrieve.mockResolvedValue({
      id: 'version-1',
      lowflowDefinition: {
        schemaVersion: 4,
        nodes: [
          {
            id: 'review',
            name: '审批',
            notifications: [{ event: 'NodeEntered' }],
          },
        ],
      },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '编辑')).trigger('click');
    await flushPromises();
    await flushPromises();
    const modal = required(editor(wrapper));
    expect(modal.findComponent(Form).props('model')).toMatchObject({
      eventName: 'NodeEntered',
      nodeKey: 'review',
    });
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'NodeEntered', nodeKey: 'review' }),
    );
    wrapper.unmount();
  });

  it('租户及组织默认值只从授权目录和该租户组织树选取', async () => {
    api.displayFields.set('create:tenantId', {
      defaultValue: { value: 'tenant-1' },
    });
    api.displayFields.set('create:orgId', { defaultValue: { value: 'org-1' } });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    await flushPromises();
    expect(
      required(editor(wrapper)).findComponent(Form).props('model'),
    ).toMatchObject({ tenantId: 'tenant-1', orgId: 'org-1' });
    expect(api.authorizedOrgTree).toHaveBeenCalledWith('tenant-1');
    wrapper.unmount();
  });

  it('无租户列表权限时不加载租户候选并说明限制', async () => {
    api.denied.add('tenant-list');
    api.displayFields.set('create:tenantId', {
      defaultValue: { value: 'tenant-1' },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    const select = required(
      modal
        .findAllComponents(Select)
        .find((item) => item.attributes('data-testid') === 'route-form-tenant'),
    );
    expect(select.props('disabled')).toBe(true);
    expect(api.tenantOptions).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('当前账号无租户查询权限');
    wrapper.unmount();
  });

  it('不使用属于其他租户的组织默认值', async () => {
    api.displayFields.set('create:tenantId', {
      defaultValue: { value: 'tenant-1' },
    });
    api.displayFields.set('create:orgId', { defaultValue: { value: 'org-1' } });
    api.authorizedOrgTree.mockResolvedValue([
      { id: 'org-1', name: '其他组织', tenantId: 'tenant-2' },
    ]);
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    await flushPromises();
    expect(
      required(required(editor(wrapper)).findComponent(Form).props('model'))
        .orgId,
    ).toBeUndefined();
    wrapper.unmount();
  });

  it('未授权的流程默认值不会写入表单', async () => {
    api.displayFields.set('create:processKey', {
      defaultValue: { value: 'other-process' },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    expect(
      required(required(editor(wrapper)).findComponent(Form).props('model'))
        .processKey,
    ).toBe('');
    wrapper.unmount();
  });

  it('机器人默认目标只允许当前渠道返回的群', async () => {
    api.displayFields.set('create:channel', {
      defaultValue: { value: 'FeishuWebhook' },
    });
    api.displayFields.set('create:targetConfig', {
      defaultValue: { value: { groupId: 'group-1' } },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    const group = required(editor(wrapper))
      .findAllComponents(Select)
      .find((item) =>
        item
          .props('options')
          ?.some((option) => 'value' in option && option.value === 'group-1'),
      );
    expect(required(group).props('value')).toBe('group-1');
    wrapper.unmount();
  });

  it('精确匹配条件默认值按保存校验提交', async () => {
    api.displayFields.set('create:matchCondition', {
      defaultValue: { value: { kind: 'normal' } },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    required(editor(wrapper)).vm.$emit('ok');
    await flushPromises();
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ matchCondition: { kind: 'normal' } }),
    );
    wrapper.unmount();
  });

  it('首次可见时应用默认值，隐藏再显示不覆盖用户输入', async () => {
    api.displayFields.set('create:remark', {
      defaultValue: {
        value: '首次默认',
        applyWhen: 'initialize-or-first-visible',
      },
      visibility: { expression: 'form.channel === "Email"' },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    const form = modal.findComponent(Form);
    const model = required(form.props('model'));
    expect(model.remark).toBe('');
    model.channel = 'Email';
    await flushPromises();
    expect(model.remark).toBe('首次默认');
    model.remark = '用户填写';
    model.channel = 'Station';
    await flushPromises();
    model.channel = 'Email';
    await flushPromises();
    expect(model.remark).toBe('用户填写');
    wrapper.unmount();
  });

  it('表单打开后授权变化会拒绝保存', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    api.assertCheckpoint.mockImplementation(() => {
      throw new Error('权限上下文已变化');
    });
    required(editor(wrapper)).vm.$emit('ok');
    await flushPromises();
    expect(api.create).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('详情无读取权限的字段不可见，编辑不提交该字段', async () => {
    api.deniedFields.add('remark');
    api.retrieve.mockResolvedValue({ ...record, remark: '敏感备注' });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '编辑')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    expect(
      modal.findAllComponents(Form.Item).map((item) => item.props('label')),
    ).not.toContain('备注');
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.update).toHaveBeenCalledOnce();
    expect(api.update.mock.calls[0]?.[0]).not.toHaveProperty('remark');
    wrapper.unmount();
  });

  it('无权提交已固定的组织范围时拒绝更新而不是静默扩大范围', async () => {
    api.records = [{ ...record, tenantId: 'tenant-1', orgId: 'org-1' }];
    api.retrieve.mockResolvedValue({
      ...record,
      tenantId: 'tenant-1',
      orgId: 'org-1',
    });
    api.deniedFields.add('orgId');
    api.assertInput.mockImplementation((_operation, payload) => {
      if (payload.orgId) throw new Error('组织范围无权提交');
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '编辑')).trigger('click');
    await flushPromises();
    required(editor(wrapper)).vm.$emit('ok');
    await flushPromises();
    expect(api.assertInput).toHaveBeenCalledWith('update', {
      tenantId: 'tenant-1',
      orgId: 'org-1',
    });
    expect(api.update).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('范围字段设为不提交时不能静默扩大更新范围', async () => {
    api.records = [{ ...record, tenantId: 'tenant-1', orgId: 'org-1' }];
    api.retrieve.mockResolvedValue({
      ...record,
      tenantId: 'tenant-1',
      orgId: 'org-1',
    });
    api.displayFields.set('edit:orgId', {
      hidden: true,
      submitWhenHidden: false,
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '编辑')).trigger('click');
    await flushPromises();
    required(editor(wrapper)).vm.$emit('ok');
    await flushPromises();
    expect(api.update).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('专用表单依赖与表达式使用完整表单身份并在条件不满足时隐藏', async () => {
    api.displayFields.set('create:processKey', { hidden: true });
    api.displayFields.set('create:nodeKey', {
      visibility: {
        dependsOn: {
          fieldKeys: ['form:workflow-notification-route-create:processKey'],
        },
      },
    });
    api.displayFields.set('create:remark', {
      visibility: { expression: 'form.channel === "Email"' },
    });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    modal.findComponent(Collapse).vm.$emit('update:activeKey', ['advanced']);
    await flushPromises();
    const labels = modal
      .findAllComponents(Form.Item)
      .map((item) => item.props('label'));
    expect(labels).not.toContain('适用节点');
    expect(labels).not.toContain('备注');
    wrapper.unmount();
  });

  it('隐藏但允许提交的字段仍受授权约束，必填设置生效', async () => {
    api.displayFields.set('create:remark', {
      hidden: true,
      submitWhenHidden: true,
    });
    api.displayFields.set('create:processKey', { required: true });
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    await required(findButton(wrapper, '新增通知渠道')).trigger('click');
    await flushPromises();
    const modal = required(editor(wrapper));
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.create).not.toHaveBeenCalled();
    const process = required(
      modal
        .findAllComponents(Select)
        .find((item) => item.attributes('data-testid') === 'route-process'),
    );
    process.vm.$emit('update:value', 'leave-process');
    await flushPromises();
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ remark: '', processKey: 'leave-process' }),
    );
    wrapper.unmount();
  });

  it('机器人选择已授权通知群并保存群标识', async () => {
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
        .findAllComponents(Select)
        .find((item) =>
          String(item.props('placeholder')).includes('机器人通知群'),
        ),
    );
    expect(target.props('value')).toBeUndefined();
    target.vm.$emit('update:value', 'group-1');
    target.vm.$emit('change', 'group-1');
    await flushPromises();
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'FeishuWebhook',
        targetConfig: { groupId: 'group-1' },
      }),
    );
    wrapper.unmount();
  });

  it('旧机器人引用不自动映射为通知群', async () => {
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
    modal.vm.$emit('ok');
    await flushPromises();
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        targetConfig: { configRef: 'tenant:tenant-1:ops' },
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
      'notification:retrieve',
      'notification:update',
      'notification:remove',
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
    const toggle = required(
      wrapper
        .findAllComponents(Switch)
        .find((item) => item.props('checked') === true),
    );
    api.update.mockRejectedValueOnce(new Error('版本冲突'));
    toggle.vm.$emit('change', false);
    await flushPromises();
    expect(api.assertInput).toHaveBeenCalledWith('update', {
      id: 'route-1',
      optimisticLock: 4,
      enable: false,
    });
    expect(api.update).toHaveBeenCalledWith({
      id: 'route-1',
      optimisticLock: 4,
      enable: false,
    });
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
    api.assertCheckpoint.mockImplementation(() => {
      throw new Error('授权变更');
    });
    required(
      wrapper
        .findAllComponents(Switch)
        .find((item) => item.props('checked') === true),
    ).vm.$emit('change', false);
    await flushPromises();
    expect(api.update).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('等待授权期间切换业务范围时不提交旧记录', async () => {
    const wrapper = mount(WorkflowNotificationRoutePage);
    await flushPromises();
    let resolvePolicy!: (value: object) => void;
    api.ensure.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePolicy = resolve;
      }),
    );
    required(
      wrapper
        .findAllComponents(Switch)
        .find((item) => item.props('checked') === true),
    ).vm.$emit('change', false);
    wrapper.findComponent({ name: 'SupportScopeSelector' }).vm.$emit('change', {
      id: 'org-1',
      tenantId: 'tenant-1',
      kind: 'org',
      name: '研发',
    });
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
