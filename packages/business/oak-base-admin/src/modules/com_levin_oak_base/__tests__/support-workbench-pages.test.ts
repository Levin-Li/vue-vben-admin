import type { PropType } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import InboxPage from '../views/inbox/index.vue';
import AuditPage from '../views/notification-audit/index.vue';
import MailboxPage from '../views/support-mailbox-rule/index.vue';
import QueuePage from '../views/ticket-queue/index.vue';
import TicketPage from '../views/ticket/index.vue';
import WorkflowRoutePage from '../views/workflow-notification-route/index.vue';

const mocks = vi.hoisted(() => ({
  userInfo: { platformUser: true, tenantId: 'tenant' },
  users: vi.fn(),
  roles: vi.fn(),
  allowed: new Set<string>(),
  enumOptions: vi.fn(),
  sourceOptions: vi.fn(),
  workflowRoute: {
    list: vi.fn(),
    retrieve: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  route: { query: {} as Record<string, unknown> },
  push: vi.fn(),
  queue: {
    list: vi.fn(),
    retrieve: vi.fn(),
    save: vi.fn(),
    setEnabled: vi.fn(),
  },
  mailbox: {
    list: vi.fn(),
    retrieve: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  },
  audit: {
    list: vi.fn(),
    retrieve: vi.fn(),
    retry: vi.fn(),
    resolveUnsent: vi.fn(),
  },
  inbox: {
    list: vi.fn(),
    retrieve: vi.fn(),
    download: vi.fn(),
    intake: vi.fn(),
  },
  ticket: {
    list: vi.fn(),
    retrieve: vi.fn(),
    messages: vi.fn(),
    message: vi.fn(),
    assign: vi.fn(),
    start: vi.fn(),
    resolve: vi.fn(),
    reopen: vi.fn(),
    close: vi.fn(),
    confirmContact: vi.fn(),
    reply: vi.fn(),
    outbound: vi.fn(),
    retryOutbound: vi.fn(),
    resolveOutboundUnsent: vi.fn(),
    attachmentDownload: vi.fn(),
  },
  notify: { error: vi.fn(), success: vi.fn() },
}));
vi.mock('../api/workflow-notification-route-service', () => ({
  workflowNotificationRouteService: mocks.workflowRoute,
}));
vi.mock('../api/ticket-service', () => ({ ticketService: mocks.ticket }));
vi.mock('../api/ticket-queue-service', () => ({
  ticketQueueService: mocks.queue,
}));
vi.mock('../api/support-mailbox-rule-service', () => ({
  supportMailboxRuleService: mocks.mailbox,
}));
vi.mock('../api/notification-audit-service', () => ({
  notificationAuditService: mocks.audit,
}));
vi.mock('../api/inbox-service', () => ({ inboxService: mocks.inbox }));
vi.mock('../views/crud-page.vue', () => ({
  default: {
    props: ['config'],
    template:
      '<main><slot name="search-field-orgId" /><slot name="toolbar-extra" /></main>',
  },
}));
// 工作流通知路由直接接入公共 CRUD；模拟其查询快照、分页和具名插槽合同。
vi.mock(
  '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue',
  async () => {
    const { defineComponent } = await import('vue');
    const { Table } = await import('ant-design-vue');
    type MockCrudConfig = {
      initialQuery?: Record<string, unknown>;
      fields: {
        key: string;
        options?: { label: string; value: string }[];
        loadOptions?: () => Promise<{ label: string; value: string }[]>;
        search?: boolean;
        table?: boolean;
        tableValue?: (record: Record<string, unknown>) => unknown;
      }[];
      apiService: {
        list: (query: Record<string, unknown>) => Promise<{
          items: Record<string, unknown>[];
        }>;
      };
    };
    return {
      default: defineComponent({
        components: { Table },
        props: {
          config: { type: Object as PropType<MockCrudConfig>, required: true },
        },
        data() {
          return {
            query: { ...this.config.initialQuery } as Record<string, unknown>,
            appliedQuery: { ...this.config.initialQuery } as Record<
              string,
              unknown
            >,
            rows: [] as Record<string, unknown>[],
            channels: [] as { label: string; value: string }[],
            pageIndex: 1,
          };
        },
        async mounted() {
          this.channels =
            (await this.config.fields
              .find((field) => field.key === 'channel')
              ?.loadOptions?.()) ?? [];
          await this.loadList();
        },
        methods: {
          async loadList() {
            const result = await this.config.apiService.list({
              ...this.appliedQuery,
              pageIndex: this.pageIndex,
              pageSize: 20,
            });
            this.rows = result.items;
          },
          search() {
            this.pageIndex = 1;
            this.appliedQuery = { ...this.query };
            return this.loadList();
          },
          reset() {
            this.query.eventName = undefined;
            this.query.channel = undefined;
            this.query.status = undefined;
          },
          changePage(page: { current: number }) {
            this.pageIndex = page.current;
            return this.loadList();
          },
        },
        template: `<main>
          <slot name="search-field-orgId" :search-state="query" />
          <select v-if="config.fields.some(field => field.key === 'eventName' && field.search)" v-model="query.eventName"><option value="">全部事件</option><option v-for="item in config.fields.find(field => field.key === 'eventName').options" :key="item.value" :value="item.value">{{ item.label }}</option></select>
          <select v-if="config.fields.some(field => field.key === 'channel' && field.search)" v-model="query.channel"><option value="">全部渠道</option><option v-for="item in channels" :key="item.value" :value="item.value">{{ item.label }}</option></select>
          <select v-if="config.fields.some(field => field.key === 'status' && field.search)" v-model="query.status"><option value="">全部状态</option><option v-for="item in config.fields.find(field => field.key === 'status').options" :key="item.value" :value="item.value">{{ item.label }}</option></select>
          <button @click="search">查询</button><button @click="reset">重置</button>
          <slot name="toolbar-extra" :load-list="loadList" :is-list-operation-visible="() => true" />
          <Table :data-source="rows" :columns="[]" @change="changePage" />
          <div v-for="record in rows" :key="record.id"><span v-for="field in config.fields.filter(field => field.table)" :key="field.key">{{ field.tableValue ? field.tableValue(record) : record[field.key] }}</span><slot name="row-actions" :record="record" :reload="loadList" /></div>
          <slot v-if="!rows.length" name="emptyText" />
        </main>`,
      }),
    };
  },
);
vi.mock('../api/user-service', () => ({ userService: { list: mocks.users } }));
vi.mock('../api/role-service', () => ({ roleService: { list: mocks.roles } }));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: mocks.userInfo }),
}));
vi.mock('../views/api-module', () => ({
  moduleFetchEnumOptions: mocks.enumOptions,
  moduleFetchOptions: mocks.sourceOptions,
}));
vi.mock('../views/support-scope-selector.vue', () => ({
  default: {
    emits: ['change'],
    template: `<button @click="$emit('change', { id: 'org', kind: 'org', tenantId: 'tenant' })">选择范围</button>`,
  },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({
    hasPermission: (permissions: string[]) =>
      permissions.every((permission) => mocks.allowed.has(permission)),
  }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<div><slot /></div>' },
}));
vi.mock('ant-design-vue', () => {
  const plain = { template: '<div><slot /></div>' };
  return {
    Alert: { props: ['message'], template: '<div>{{ message }}</div>' },
    Button: {
      props: ['disabled'],
      emits: ['click'],
      template: `<button :disabled="disabled" @click="$emit('click')"><slot /></button>`,
    },
    Form: { ...plain, Item: plain },
    Collapse: {
      ...plain,
      Panel: {
        props: ['header'],
        template: '<div>{{ header }}<slot /></div>',
      },
    },
    Empty: { props: ['description'], template: '<div>{{ description }}</div>' },
    InputNumber: {
      props: ['value'],
      emits: ['update:value'],
      template: `<input type="number" :value="value" @input="$emit('update:value', Number($event.target.value))" />`,
    },
    Timeline: { ...plain, Item: plain },
    Pagination: plain,
    Input: {
      TextArea: {
        props: ['value', 'disabled'],
        emits: ['update:value'],
        template: `<textarea :value="value" :disabled="disabled" @input="$emit('update:value', $event.target.value)" />`,
      },
      props: ['value', 'placeholder'],
      emits: ['update:value'],
      template: `<input :value="value" :placeholder="placeholder" @input="$emit('update:value', $event.target.value)" />`,
    },
    Switch: {
      props: ['checked'],
      emits: ['update:checked'],
      template: `<input type="checkbox" :checked="checked" @change="$emit('update:checked', $event.target.checked)" />`,
    },
    Checkbox: {
      props: ['checked'],
      emits: ['update:checked'],
      template: `<label><input type="checkbox" :checked="checked" @change="$emit('update:checked', $event.target.checked)" /><slot /></label>`,
    },
    Select: {
      props: ['value', 'options', 'mode'],
      emits: ['update:value'],
      template: `<select :value="value" @change="$emit('update:value', mode === 'multiple' ? [$event.target.value] : $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>`,
    },
    Modal: {
      props: ['open', 'title', 'footer'],
      emits: ['ok'],
      template: `<section v-if="open"><h3>{{ title }}</h3><slot /><button v-if="footer !== null" @click="$emit('ok')">确认</button></section>`,
    },
    Descriptions: { ...plain, Item: plain },
    Tag: plain,
    Table: {
      name: 'Table',
      emits: ['change'],
      props: ['columns', 'dataSource'],
      template: `<div><div v-for="record in dataSource" :key="record.id || record.attemptNo"><div v-for="column in columns" :key="column.key || column.dataIndex"><span>{{ record[column.dataIndex] }}</span><slot name="bodyCell" :record="record" :column="column" /></div></div></div>`,
    },
    message: mocks.notify,
  };
});
const queue = {
  id: 'queue',
  tenantId: 'tenant',
  orgId: 'org',
  code: 'support',
  name: '支持队列',
  enabled: false,
  optimisticLock: 7,
  handlerUserIds: ['user'],
  handlerRoleCodes: [],
};
const mailbox = {
  id: 'rule',
  tenantId: 'tenant',
  orgId: 'org',
  email: 'support@example.com',
  inboundChannel: 'LocalSmtp',
  queueId: 'queue',
  enabled: false,
  optimisticLock: 4,
  defaultPriority: 'Normal',
};
const delivery = {
  id: 'delivery',
  eventId: 'event',
  channel: 'Email',
  status: 'Unknown',
  optimisticLock: 9,
  attemptCount: 1,
  exhausted: false,
};
function button(wrapper: ReturnType<typeof mount>, text: string) {
  const result = wrapper.findAll('button').find((item) => item.text() === text);
  if (!result) throw new Error(`按钮不存在：${text}`);
  return result;
}
describe('邮件工单工作台业务入口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userInfo = { platformUser: true, tenantId: 'tenant' };
    mocks.sourceOptions.mockResolvedValue([]);
    mocks.users.mockResolvedValue({
      items: [{ id: 'user', realName: 'Queue handler' }],
    });
    mocks.roles.mockResolvedValue({
      items: [{ code: 'R_HANDLER', name: 'Handler role', tenantId: 'tenant' }],
    });
    mocks.enumOptions.mockImplementation(async (name: string) => {
      if (name.endsWith('$InboundChannel'))
        return [
          { label: 'SMTP', value: 'LocalSmtp' },
          { label: 'Forward Email', value: 'ForwardEmail' },
        ];
      if (name.endsWith('$Status'))
        return [
          { label: '结果未知', value: 'Unknown' },
          { label: '已受理', value: 'Delivered' },
        ];
      if (name.endsWith('$Channel'))
        return [
          { label: '站内通知', value: 'Station' },
          { label: '邮件通知', value: 'Email' },
          { label: '飞书 Webhook', value: 'FeishuWebhook' },
          { label: '企业微信 Webhook', value: 'WeComWebhook' },
          { label: '钉钉 Webhook', value: 'DingTalkWebhook' },
        ];
      return [];
    });
    mocks.workflowRoute.list.mockResolvedValue({ items: [], totals: 0 });
    mocks.allowed = new Set([
      'assign',
      'attachmentDownload',
      'close',
      'confirmContact',
      'create',
      'disable',
      'download',
      'enable',
      'intake',
      'list',
      'message',
      'messages',
      'outbound',
      'remove',
      'reopen',
      'reply',
      'resolve',
      'resolveOutboundUnsent',
      'resolveUnsent',
      'retrieve',
      'retry',
      'retryOutbound',
      'save',
      'setEnabled',
      'start',
      'update',
    ]);
    mocks.route.query = {};
    mocks.queue.list.mockResolvedValue({ items: [queue], totals: 1 });
    mocks.queue.retrieve.mockResolvedValue(queue);
    mocks.mailbox.list.mockResolvedValue({ items: [mailbox], totals: 1 });
    mocks.mailbox.retrieve.mockResolvedValue(mailbox);
    mocks.audit.list.mockResolvedValue({ items: [delivery], totals: 1 });
    mocks.audit.retrieve.mockResolvedValue({
      delivery,
      attempts: [],
      reviews: [],
    });
    mocks.inbox.list.mockResolvedValue({ items: [], totals: 0 });
    mocks.ticket.list.mockResolvedValue({ items: [], totals: 0 });
    mocks.ticket.messages.mockResolvedValue({ items: [], totals: 0 });
    mocks.ticket.retrieve.mockResolvedValue({
      id: 'ticket-1',
      title: '客服工单',
      status: 'InProgress',
      optimisticLock: 6,
      requesterEmail: 'requester@example.com',
      confirmedContactEmail: 'requester@example.com',
      supportEventsByCurrentStatus: ['回复'],
    });
  });
  it.each([true, false])(
    '队列候选使用真实DTO范围且保存仍携带tenant，platform=%s',
    async (platformUser) => {
      mocks.userInfo = { platformUser, tenantId: 'tenant' };
      const wrapper = mount(QueuePage);
      await button(wrapper, '选择范围').trigger('click');
      await flushPromises();
      await button(wrapper, '新建队列').trigger('click');
      await flushPromises();
      const [userSelect, roleSelect] = wrapper.findAll('select');
      if (!userSelect || !roleSelect)
        throw new Error('Missing handler selectors');
      await userSelect.trigger('focus');
      await roleSelect.trigger('focus');
      await flushPromises();
      const tenantScope = platformUser ? { tenantId: 'tenant' } : {};
      expect(mocks.users).toHaveBeenCalledWith({
        ...tenantScope,
        orgId: 'org',
        orgIdList: ['org'],
        enable: true,
        containsName: '',
        pageIndex: 1,
        pageSize: 100,
      });
      expect(mocks.roles).toHaveBeenCalledWith({
        ...tenantScope,
        containsPublicData: false,
        enable: true,
        containsName: '',
        pageIndex: 1,
        pageSize: 100,
      });
      expect(userSelect.text()).toContain('Queue handler');
      expect(roleSelect.text()).toContain('Handler role');
      await userSelect.setValue('user');
      await roleSelect.setValue('R_HANDLER');
      const inputs = wrapper
        .findAll('input')
        .filter((input) => input.attributes('type') !== 'checkbox');
      const [codeInput, nameInput] = inputs;
      if (!codeInput || !nameInput) throw new Error('Missing queue fields');
      await codeInput.setValue('queue-code');
      await nameInput.setValue('Queue name');
      await button(wrapper, '确认').trigger('click');
      await flushPromises();
      expect(mocks.queue.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant',
          orgId: 'org',
          code: 'queue-code',
          name: 'Queue name',
          handlerUserIds: ['user'],
          handlerRoleCodes: ['R_HANDLER'],
        }),
      );
    },
  );

  it.each([
    { platformUser: true, channel: 'LocalSmtp' },
    { platformUser: false, channel: 'LocalSmtp' },
    { platformUser: true, channel: 'ForwardEmail' },
    { platformUser: false, channel: 'ForwardEmail' },
  ])(
    '邮箱来源及默认处理人按正式DTO查询 $channel platform=$platformUser',
    async ({ platformUser, channel }) => {
      mocks.userInfo = { platformUser, tenantId: 'tenant' };
      const wrapper = mount(MailboxPage);
      await flushPromises();
      await button(wrapper, '选择范围').trigger('click');
      await flushPromises();
      await button(wrapper, '创建受理邮箱').trigger('click');
      await flushPromises();
      const selects = wrapper.findAll('section select');
      const channelSelect = selects.find((select) =>
        select
          .findAll('option')
          .some((option) => option.attributes('value') === channel),
      );
      if (!channelSelect) throw new Error('Missing source channel');
      await channelSelect.setValue(channel);
      await flushPromises();
      const fields = wrapper.findAll('section select');
      const assignee = fields[3];
      const source = fields[1];
      if (!source || !assignee)
        throw new Error('Missing mailbox source/assignee');
      await source.trigger('focus');
      await assignee.trigger('focus');
      await flushPromises();
      const tenantScope = platformUser ? { tenantId: 'tenant' } : {};
      expect(mocks.users).toHaveBeenLastCalledWith({
        ...tenantScope,
        orgId: 'org',
        orgIdList: ['org'],
        enable: true,
        containsName: '',
        pageIndex: 1,
        pageSize: 100,
      });
      expect(mocks.sourceOptions).toHaveBeenLastCalledWith(
        channel === 'LocalSmtp' ? '/Domain/list' : '/EmailRelayRoute/list',
        'name',
        'id',
        {
          ...tenantScope,
          enable: true,
          pageIndex: 1,
          pageSize: 100,
          ...(channel === 'LocalSmtp'
            ? {
                containsName: '',
                containsPublicData: false,
                lifecycleStatus: 'Active',
                emailReceivingEnabled: true,
              }
            : { containsLocalPart: '', syncStatus: 'Synced' }),
        },
      );
      expect(assignee.text()).toContain('Queue handler');
      expect(mocks.mailbox.create).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    '工单分派处理人沿正式组织DTO查询 platform=%s',
    async (platformUser) => {
      mocks.userInfo = { platformUser, tenantId: 'tenant' };
      mocks.route.query = { id: 'ticket-1' };
      mocks.ticket.retrieve.mockResolvedValue({
        id: 'ticket-1',
        tenantId: 'tenant',
        orgId: 'org',
        status: 'InProgress',
        optimisticLock: 6,
        supportEventsByCurrentStatus: ['分派'],
      });
      const wrapper = mount(TicketPage);
      await flushPromises();
      await button(wrapper, '分派').trigger('click');
      await flushPromises();
      const assignee = wrapper.find('section select');
      await assignee.trigger('focus');
      await flushPromises();
      expect(mocks.users).toHaveBeenLastCalledWith({
        ...(platformUser ? { tenantId: 'tenant' } : {}),
        orgId: 'org',
        orgIdList: ['org'],
        enable: true,
        containsName: '',
        pageIndex: 1,
        pageSize: 100,
      });
      expect(assignee.text()).toContain('Queue handler');
      expect(mocks.ticket.assign).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    '队列角色遵守实际平台公共并集和租户字段mask platform=%s',
    async (platformUser) => {
      mocks.userInfo = { platformUser, tenantId: 'tenant' };
      const actualPlatformRows = [
        {
          code: 'R_CUSTOMER',
          tenantId: 'tenant',
          name: 'Tenant customer',
          publicRole: false,
        },
        {
          code: 'R_ORG_ADMIN',
          tenantId: 'tenant',
          name: 'Tenant department admin',
          publicRole: false,
        },
        {
          code: 'R_ADMIN',
          tenantId: 'tenant',
          name: 'Tenant admin',
          publicRole: false,
        },
        {
          code: 'R_ADMIN',
          tenantId: null,
          name: 'Public admin',
          publicRole: true,
        },
        {
          code: 'R_PLATFORM_ADMIN',
          tenantId: null,
          name: 'Public platform admin',
          publicRole: true,
        },
        {
          code: 'R_PLATFORM_SA',
          tenantId: null,
          name: 'Public super admin',
          publicRole: true,
        },
      ];
      mocks.roles.mockResolvedValue({
        items: platformUser
          ? actualPlatformRows
          : actualPlatformRows
              .slice(0, 3)
              .map((row) => ({ ...row, tenantId: undefined })),
      });
      const wrapper = mount(QueuePage);
      await button(wrapper, '选择范围').trigger('click');
      await flushPromises();
      await button(wrapper, '新建队列').trigger('click');
      await flushPromises();
      const roleSelect = wrapper.findAll('select')[1];
      if (!roleSelect) throw new Error('Missing role selector');
      await roleSelect.trigger('focus');
      await flushPromises();
      expect(
        roleSelect
          .findAll('option')
          .map((option) => option.attributes('value')),
      ).toEqual(['R_CUSTOMER', 'R_ORG_ADMIN', 'R_ADMIN']);
      expect(roleSelect.text()).not.toContain('Public');
      expect(mocks.queue.save).not.toHaveBeenCalled();
    },
  );

  it('工作流通知页提供三家服务端渠道，只提交选定租户的逻辑引用', async () => {
    const wrapper = mount(WorkflowRoutePage);
    await flushPromises();
    expect(wrapper.text()).toContain('任务完成');
    expect(wrapper.text()).toContain('当前范围暂无通知路由');
    expect(wrapper.text()).toContain('飞书 Webhook');
    expect(wrapper.text()).toContain('企业微信 Webhook');
    expect(wrapper.text()).toContain('钉钉 Webhook');
    await button(wrapper, '选择范围').trigger('click');
    await flushPromises();
    await button(wrapper, '新增通知路由').trigger('click');
    await flushPromises();
    const channelSelect = wrapper
      .findAll('select')
      .find(
        (select) =>
          select
            .findAll('option')
            .some((option) => option.attributes('value') === 'FeishuWebhook') &&
          select.element.closest('[name="workflowNotificationRouteEdit"]'),
      );
    if (!channelSelect) throw new Error('渠道选择器不存在');
    await channelSelect.setValue('FeishuWebhook');
    await flushPromises();
    await wrapper
      .get('input[placeholder="tenant:租户标识:已部署目标名称"]')
      .setValue('tenant:tenant:ops');
    await button(wrapper, '确认').trigger('click');
    await flushPromises();
    expect(mocks.workflowRoute.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant',
        orgId: 'org',
        eventName: 'TaskCreated',
        channel: 'FeishuWebhook',
        targetConfig: { configRef: 'tenant:tenant:ops' },
      }),
    );
    expect(wrapper.find('input[placeholder="Webhook URL"]').exists()).toBe(
      false,
    );
  });

  it('通知路由筛选手动查询，分页沿用快照且重置不请求', async () => {
    const wrapper = mount(WorkflowRoutePage);
    await flushPromises();
    await button(wrapper, '选择范围').trigger('click');
    await flushPromises();
    const initialCalls = mocks.workflowRoute.list.mock.calls.length;
    const [eventSelect, channelSelect] = wrapper.findAll('select');
    if (!eventSelect || !channelSelect) throw new Error('缺少事件或渠道筛选');
    await eventSelect.setValue('TaskProcessed');
    await channelSelect.setValue('Email');
    await flushPromises();
    expect(mocks.workflowRoute.list).toHaveBeenCalledTimes(initialCalls);
    await button(wrapper, '查询').trigger('click');
    await flushPromises();
    expect(mocks.workflowRoute.list).toHaveBeenLastCalledWith({
      tenantId: 'tenant',
      orgId: 'org',
      eventName: 'TaskProcessed',
      channel: 'Email',
      pageIndex: 1,
      pageSize: 20,
    });
    await channelSelect.setValue('Station');
    wrapper.getComponent({ name: 'Table' }).vm.$emit('change', { current: 2 });
    await flushPromises();
    expect(mocks.workflowRoute.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ channel: 'Email', pageIndex: 2 }),
    );
    const queriedCalls = mocks.workflowRoute.list.mock.calls.length;
    await button(wrapper, '重置').trigger('click');
    await flushPromises();
    expect(mocks.workflowRoute.list).toHaveBeenCalledTimes(queriedCalls);
    await button(wrapper, '查询').trigger('click');
    await flushPromises();
    expect(mocks.workflowRoute.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ eventName: undefined, channel: undefined }),
    );
  });

  it('投递记录筛选手动查询，切换范围立即清除详情且重置不请求', async () => {
    const wrapper = mount(AuditPage);
    await flushPromises();
    await button(wrapper, '查看详情').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('通知投递详情');
    const initialCalls = mocks.audit.list.mock.calls.length;
    await button(wrapper, '选择范围').trigger('click');
    await flushPromises();
    expect(wrapper.find('select').html()).toContain('Unknown');
    await wrapper.find('select').setValue('Unknown');
    await flushPromises();
    expect(mocks.audit.list).toHaveBeenCalledTimes(initialCalls + 1);
    expect(wrapper.text()).not.toContain('通知投递详情');
    await button(wrapper, '查询').trigger('click');
    await flushPromises();
    expect(mocks.audit.list).toHaveBeenLastCalledWith({
      tenantId: 'tenant',
      orgId: 'org',
      status: 'Unknown',
      pageIndex: 1,
      pageSize: 20,
    });
    const queriedCalls = mocks.audit.list.mock.calls.length;
    await button(wrapper, '重置').trigger('click');
    await flushPromises();
    expect(mocks.audit.list).toHaveBeenCalledTimes(queriedCalls);
  });

  it('机器人路由拒绝跨租户引用，不发送配置请求', async () => {
    const wrapper = mount(WorkflowRoutePage);
    await flushPromises();
    await button(wrapper, '选择范围').trigger('click');
    await flushPromises();
    await button(wrapper, '新增通知路由').trigger('click');
    const selects = wrapper.findAll(
      '[name="workflowNotificationRouteEdit"] select',
    );
    const channelSelect = selects.find((select) =>
      select
        .findAll('option')
        .some((option) => option.attributes('value') === 'FeishuWebhook'),
    );
    if (!channelSelect) throw new Error('渠道选择器不存在');
    await channelSelect.setValue('FeishuWebhook');
    await flushPromises();
    await wrapper
      .get('input[placeholder="tenant:租户标识:已部署目标名称"]')
      .setValue('tenant:other:ops');
    await button(wrapper, '确认').trigger('click');
    expect(mocks.workflowRoute.create).not.toHaveBeenCalled();
    expect(mocks.notify.error).toHaveBeenCalledWith(
      '机器人目标必须与当前路由作用域的逻辑配置引用一致',
    );
  });

  it('编辑路由保留高级匹配配置并使用任务完成事件值', async () => {
    const route = {
      id: 'route-1',
      tenantId: 'tenant',
      orgId: 'org',
      processKey: 'approval',
      nodeKey: 'review',
      workflowDefinitionVersionId: '',
      eventName: 'TaskProcessed',
      channel: 'Station',
      priority: 20,
      forceOverride: true,
      enable: true,
      matchCondition: { businessType: 'request' },
      targetConfig: {},
      optimisticLock: 3,
    };
    mocks.workflowRoute.list.mockResolvedValue({ items: [route], totals: 1 });
    mocks.workflowRoute.retrieve.mockResolvedValue(route);
    const wrapper = mount(WorkflowRoutePage);
    await flushPromises();
    await button(wrapper, '编辑').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('高级匹配与覆盖');
    await button(wrapper, '确认').trigger('click');
    await flushPromises();
    expect(mocks.workflowRoute.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'route-1',
        eventName: 'TaskProcessed',
        processKey: 'approval',
        nodeKey: 'review',
        priority: 20,
        forceOverride: true,
        matchCondition: { businessType: 'request' },
        optimisticLock: 3,
      }),
    );
  });

  it('审计从服务端枚举呈现飞书渠道，不显示群配置或秘密', async () => {
    mocks.audit.list.mockResolvedValue({
      items: [{ ...delivery, channel: 'FeishuWebhook' }],
      totals: 1,
    });
    const wrapper = mount(AuditPage);
    await flushPromises();
    expect(wrapper.text()).toContain('飞书 Webhook');
    expect(mocks.enumOptions).toHaveBeenCalledWith(
      'com.levin.oak.base.entities.NotificationDelivery$Channel',
    );
    expect(wrapper.text()).not.toContain('configRef');
  });

  it('队列只查询选择的范围，启用必须回传当前版本', async () => {
    const wrapper = mount(QueuePage);
    await flushPromises();
    expect(mocks.queue.list).not.toHaveBeenCalled();
    await button(wrapper, '选择范围').trigger('click');
    await flushPromises();
    expect(mocks.queue.list).toHaveBeenCalledWith({
      tenantId: 'tenant',
      orgId: 'org',
      pageIndex: 1,
      pageSize: 20,
    });
    await button(wrapper, '启用').trigger('click');
    await flushPromises();
    expect(mocks.queue.setEnabled).toHaveBeenCalledWith({
      tenantId: 'tenant',
      orgId: 'org',
      id: 'queue',
      optimisticLock: 7,
      enabled: true,
    });
  });
  it('邮箱启用调用独立动作，撤销动作权限隐藏操作', async () => {
    mocks.allowed.delete('enable');
    mocks.allowed.delete('update');
    const wrapper = mount(MailboxPage);
    await button(wrapper, '选择范围').trigger('click');
    await flushPromises();
    expect(
      wrapper.findAll('button').some((item) => item.text() === '启用'),
    ).toBe(false);
    expect(
      wrapper.findAll('button').some((item) => item.text() === '修改'),
    ).toBe(false);
    expect(mocks.mailbox.enable).not.toHaveBeenCalled();
  });
  it('未知投递只提供未受理核验，不能直接重发；不确认则不执行', async () => {
    const wrapper = mount(AuditPage);
    await flushPromises();
    await button(wrapper, '查看详情').trigger('click');
    await flushPromises();
    expect(
      wrapper.findAll('button').some((item) => item.text() === '重试投递'),
    ).toBe(false);
    await button(wrapper, '核验未受理').trigger('click');
    await flushPromises();
    await button(wrapper, '确认').trigger('click');
    expect(mocks.audit.resolveUnsent).not.toHaveBeenCalled();
    await wrapper
      .find('input[placeholder="无机密核验记录标识，禁止邮箱或 URL"]')
      .setValue('CASE-1');
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await button(wrapper, '确认').trigger('click');
    await flushPromises();
    expect(mocks.audit.resolveUnsent).toHaveBeenCalledWith({
      id: 'delivery',
      tenantId: undefined,
      optimisticLock: 9,
      reason: 'VerifiedUnsent',
      verifiedUnsent: true,
      verificationRef: 'CASE-1',
    });
    expect(mocks.audit.retry).not.toHaveBeenCalled();
  });
  it('已耗尽的确定失败投递不提供重试', async () => {
    mocks.audit.retrieve.mockResolvedValue({
      delivery: { ...delivery, status: 'TerminalFailed', exhausted: true },
      attempts: [],
      reviews: [],
    });
    const wrapper = mount(AuditPage);
    await flushPromises();
    await button(wrapper, '查看详情').trigger('click');
    await flushPromises();
    expect(
      wrapper.findAll('button').some((item) => item.text() === '重试投递'),
    ).toBe(false);
  });
  it('工单动作必须同时具备方法权限和服务端支持事件，查看不会执行状态动作', async () => {
    mocks.route.query = { id: 'ticket-1' };
    const wrapper = mount(TicketPage);
    await flushPromises();
    expect(mocks.ticket.retrieve).toHaveBeenCalledWith({ id: 'ticket-1' });
    expect(
      wrapper.findAll('button').some((item) => item.text() === '解决'),
    ).toBe(false);
    expect(mocks.ticket.resolve).not.toHaveBeenCalled();
    expect(mocks.ticket.reply).not.toHaveBeenCalled();
  });

  it('合法工单事件回传预期版本，不提交目标状态', async () => {
    mocks.route.query = { id: 'ticket-1' };
    mocks.ticket.retrieve.mockResolvedValue({
      id: 'ticket-1',
      title: '客服工单',
      status: 'InProgress',
      optimisticLock: 6,
      supportEventsByCurrentStatus: ['解决'],
    });
    const wrapper = mount(TicketPage);
    await flushPromises();
    await button(wrapper, '解决').trigger('click');
    await wrapper.find('textarea').setValue('已确认解决');
    await button(wrapper, '确认').trigger('click');
    await flushPromises();
    expect(mocks.ticket.resolve).toHaveBeenCalledWith({
      id: 'ticket-1',
      optimisticLock: 6,
      remark: '已确认解决',
    });
    expect(mocks.ticket.retrieve).toHaveBeenCalledTimes(2);
  });

  it('回复技术重试冻结同一键、正文和版本，Unknown不提供重发', async () => {
    mocks.route.query = { id: 'ticket-1' };
    mocks.ticket.reply
      .mockRejectedValueOnce(new Error('connection'))
      .mockResolvedValueOnce({
        id: 'intent-1',
        ticketId: 'ticket-1',
        status: 'Unknown',
        attemptCount: 1,
        optimisticLock: 2,
      });
    const wrapper = mount(TicketPage);
    await flushPromises();
    await button(wrapper, '邮件回复').trigger('click');
    await wrapper.find('textarea').setValue('一次明确回复');
    await button(wrapper, '确认').trigger('click');
    await flushPromises();
    const first = mocks.ticket.reply.mock.calls[0]?.[0];
    expect(first).toMatchObject({
      id: 'ticket-1',
      optimisticLock: 6,
      body: '一次明确回复',
      attachmentIds: [],
    });
    expect(first.replyKey).toMatch(/^[\w.:-]+$/);
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined();
    await button(wrapper, '确认').trigger('click');
    await flushPromises();
    expect(mocks.ticket.reply).toHaveBeenNthCalledWith(2, first);
    expect(wrapper.text()).toContain('外发结果不明');
    expect(
      wrapper
        .findAll('button')
        .some((item) => item.text() === '重试发送前失败'),
    ).toBe(false);
    expect(mocks.ticket.retryOutbound).not.toHaveBeenCalled();
  });

  it('工单未知结果核验必须明确确认，成功不发送且新GET前不能重试', async () => {
    mocks.route.query = { id: 'ticket-1' };
    mocks.ticket.messages.mockResolvedValue({
      items: [
        {
          id: 'message-out',
          direction: 'OutboundEmail',
          body: '外发记录',
          outboundIntentId: 'intent-1',
        },
      ],
      totals: 1,
    });
    mocks.ticket.outbound.mockResolvedValueOnce({
      id: 'intent-1',
      ticketId: 'ticket-1',
      status: 'Unknown',
      attemptCount: 1,
      optimisticLock: 7,
    });
    mocks.ticket.resolveOutboundUnsent.mockResolvedValue({
      id: 'intent-1',
      ticketId: 'ticket-1',
      status: 'Failed',
      attemptCount: 1,
      optimisticLock: 8,
    });
    const wrapper = mount(TicketPage);
    await flushPromises();
    await button(wrapper, '查看外发结果').trigger('click');
    await flushPromises();
    await button(wrapper, '核验工单邮件未受理').trigger('click');
    expect(wrapper.get('input[type="checkbox"]').element).toHaveProperty(
      'checked',
      false,
    );
    await wrapper
      .get('input[placeholder="无机密证据记录标识，禁止URL、token或原文"]')
      .setValue('CASE-1');
    await button(wrapper, '确认').trigger('click');
    expect(mocks.ticket.resolveOutboundUnsent).not.toHaveBeenCalled();
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await button(wrapper, '确认').trigger('click');
    await flushPromises();
    expect(mocks.ticket.resolveOutboundUnsent).toHaveBeenCalledWith({
      id: 'ticket-1',
      intentId: 'intent-1',
      intentVersion: 7,
      verifiedUnsent: true,
      reason: 'VerifiedUnsent',
      evidenceRef: 'CASE-1',
    });
    expect(mocks.ticket.retryOutbound).not.toHaveBeenCalled();
    expect(mocks.ticket.reply).not.toHaveBeenCalled();
    expect(
      wrapper
        .findAll('button')
        .some((item) => item.text() === '重试发送前失败'),
    ).toBe(false);
    mocks.ticket.outbound.mockResolvedValueOnce({
      id: 'intent-1',
      ticketId: 'ticket-1',
      status: 'Failed',
      attemptCount: 1,
      optimisticLock: 9,
    });
    mocks.ticket.retryOutbound.mockResolvedValue({
      id: 'intent-1',
      ticketId: 'ticket-1',
      status: 'Pending',
      attemptCount: 1,
      optimisticLock: 10,
    });
    await button(wrapper, '刷新外发结果').trigger('click');
    await flushPromises();
    await button(wrapper, '重试发送前失败').trigger('click');
    await flushPromises();
    expect(mocks.ticket.retryOutbound).toHaveBeenCalledWith({
      id: 'ticket-1',
      intentId: 'intent-1',
      intentVersion: 9,
    });
  });

  it.each(['Accepted', 'Sending'])('外发%s不提供未受理核验', async (status) => {
    mocks.route.query = { id: 'ticket-1' };
    mocks.ticket.messages.mockResolvedValue({
      items: [
        { id: 'message-out', body: '记录', outboundIntentId: 'intent-1' },
      ],
      totals: 1,
    });
    mocks.ticket.outbound.mockResolvedValue({
      id: 'intent-1',
      ticketId: 'ticket-1',
      status,
      attemptCount: 1,
      optimisticLock: 7,
    });
    const wrapper = mount(TicketPage);
    await flushPromises();
    await button(wrapper, '查看外发结果').trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findAll('button')
        .some((item) => item.text() === '核验工单邮件未受理'),
    ).toBe(false);
    expect(mocks.ticket.resolveOutboundUnsent).not.toHaveBeenCalled();
  });

  it('无独立核验权限或失败次数耗尽时不开放相应动作', async () => {
    mocks.allowed.delete('resolveOutboundUnsent');
    mocks.route.query = { id: 'ticket-1' };
    mocks.ticket.messages.mockResolvedValue({
      items: [
        { id: 'message-out', body: '记录', outboundIntentId: 'intent-1' },
      ],
      totals: 1,
    });
    mocks.ticket.outbound.mockResolvedValueOnce({
      id: 'intent-1',
      ticketId: 'ticket-1',
      status: 'Unknown',
      attemptCount: 5,
      optimisticLock: 7,
    });
    const wrapper = mount(TicketPage);
    await flushPromises();
    await button(wrapper, '查看外发结果').trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findAll('button')
        .some((item) => item.text() === '核验工单邮件未受理'),
    ).toBe(false);
    mocks.ticket.outbound.mockResolvedValueOnce({
      id: 'intent-1',
      ticketId: 'ticket-1',
      status: 'Failed',
      attemptCount: 5,
      optimisticLock: 8,
    });
    await button(wrapper, '刷新外发结果').trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findAll('button')
        .some((item) => item.text() === '重试发送前失败'),
    ).toBe(false);
  });

  it('核验服务端拒绝后清空旧外发，不提供重试或自动发送', async () => {
    mocks.route.query = { id: 'ticket-1' };
    mocks.ticket.messages.mockResolvedValue({
      items: [
        { id: 'message-out', body: '记录', outboundIntentId: 'intent-1' },
      ],
      totals: 1,
    });
    mocks.ticket.outbound.mockResolvedValue({
      id: 'intent-1',
      ticketId: 'ticket-1',
      status: 'Unknown',
      attemptCount: 1,
      optimisticLock: 7,
    });
    mocks.ticket.resolveOutboundUnsent.mockRejectedValueOnce(
      new Error('permission-revoked'),
    );
    const wrapper = mount(TicketPage);
    await flushPromises();
    await button(wrapper, '查看外发结果').trigger('click');
    await flushPromises();
    await button(wrapper, '核验工单邮件未受理').trigger('click');
    await wrapper
      .get('input[placeholder="无机密证据记录标识，禁止URL、token或原文"]')
      .setValue('CASE-1');
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await button(wrapper, '确认').trigger('click');
    await flushPromises();
    expect(mocks.notify.error).toHaveBeenCalledWith(
      '核验失败，请重新读取当前外发状态与权限',
    );
    expect(
      wrapper
        .findAll('button')
        .some((item) => item.text() === '重试发送前失败'),
    ).toBe(false);
    expect(mocks.ticket.retryOutbound).not.toHaveBeenCalled();
    expect(mocks.ticket.reply).not.toHaveBeenCalled();
  });

  it('切换范围后旧外发GET响应不恢复核验或重试内容', async () => {
    mocks.route.query = { id: 'ticket-1' };
    mocks.ticket.messages.mockResolvedValue({
      items: [
        { id: 'message-out', body: '记录', outboundIntentId: 'intent-1' },
      ],
      totals: 1,
    });
    let resolveOld!: (value: unknown) => void;
    mocks.ticket.outbound.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const wrapper = mount(TicketPage);
    await flushPromises();
    await button(wrapper, '查看外发结果').trigger('click');
    await button(wrapper, '选择范围').trigger('click');
    resolveOld({
      id: 'intent-1',
      ticketId: 'ticket-1',
      status: 'Unknown',
      attemptCount: 1,
      optimisticLock: 7,
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain('结果不明，待核验');
    expect(
      wrapper
        .findAll('button')
        .some((item) => item.text() === '核验工单邮件未受理'),
    ).toBe(false);
    expect(mocks.ticket.resolveOutboundUnsent).not.toHaveBeenCalled();
  });

  it('收件箱精确定位重新授权，HTML正文只按文本显示，打开不转工单', async () => {
    mocks.route.query = { id: 'inbox-1' };
    mocks.inbox.retrieve.mockResolvedValue({
      id: 'inbox-1',
      subject: '测试邮件',
      htmlContent: '<script>alert(1)</script>',
      rawMimeFileId: 'private',
    });
    const wrapper = mount(InboxPage);
    await flushPromises();
    expect(mocks.inbox.retrieve).toHaveBeenCalledWith({ id: 'inbox-1' });
    expect(wrapper.text()).toContain('<script>alert(1)</script>');
    expect(wrapper.find('script').exists()).toBe(false);
    expect(mocks.inbox.intake).not.toHaveBeenCalled();
  });
  it('非法收件定位或详情授权失败不暴露邮件正文', async () => {
    mocks.route.query = { id: ['inbox-1', 'inbox-2'] };
    const wrapper = mount(InboxPage);
    await flushPromises();
    expect(mocks.inbox.retrieve).not.toHaveBeenCalled();
    expect(mocks.notify.error).toHaveBeenCalledWith('邮件定位参数无效');
    expect(wrapper.text()).not.toContain('邮件定位参数无效');
  });
});
