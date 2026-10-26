import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TicketPage from '../views/ticket/index.vue';

// 接口、授权目录与路由为显式替身；实际挂载工单页面，验证用户交互的请求和展示合同。
const mocks = vi.hoisted(() => ({
  userInfo: { platformUser: true, tenantId: 'tenant' },
  allowed: new Set<string>(),
  users: vi.fn(),
  enums: vi.fn(),
  notify: { error: vi.fn(), success: vi.fn() },
  push: vi.fn(),
  route: { query: {} as Record<string, unknown> },
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
}));
vi.mock('../api/ticket-service', () => ({ ticketService: mocks.ticket }));
vi.mock('../api/user-service', () => ({ userService: { list: mocks.users } }));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: mocks.userInfo }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue',
  async () => {
    const { defineComponent } = await import('vue');
    return {
      default: defineComponent({
        props: { config: { type: Object, required: true } },
        data() {
          return {
            query: { ...this.config.initialQuery },
            rows: [] as Record<string, unknown>[],
          };
        },
        mounted() {
          void this.reload();
        },
        methods: {
          async reload() {
            const result = await this.config.apiService.list({
              ...this.query,
              pageIndex: 1,
              pageSize: 20,
            });
            this.rows = result.items;
          },
        },
        template: `<main>
          <slot name="search-field-orgId" :search-state="query" />
          <slot name="toolbar-extra" :is-list-operation-visible="() => true" />
          <div v-for="record in rows" :key="record.id">
            <slot name="row-actions" :record="record" />
          </div>
        </main>`,
      }),
    };
  },
);
vi.mock('../views/api-module', () => ({ moduleFetchEnumOptions: mocks.enums }));
vi.mock('../views/support-scope-selector.vue', () => ({
  default: {
    props: ['placeholder'],
    emits: ['change'],
    template: `<button :data-placeholder="placeholder" @click="$emit('change', { id: 'org', kind: 'org', tenantId: 'tenant' })">选择范围</button>`,
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

// UI替身保留事件、禁用及模态框的真实交互契约，避免调用组件私有状态或方法。
vi.mock('ant-design-vue', () => {
  const plain = { template: '<div><slot /></div>' };
  const textarea = {
    props: ['value', 'disabled'],
    emits: ['update:value'],
    template: `<textarea :value="value" :disabled="disabled" @input="$emit('update:value', $event.target.value)" />`,
  };
  return {
    Alert: { props: ['message'], template: '<div>{{ message }}</div>' },
    Button: {
      props: ['disabled'],
      emits: ['click'],
      template: `<button :disabled="disabled" @click="$emit('click')"><slot /></button>`,
    },
    Form: { ...plain, Item: plain },
    Descriptions: { ...plain, Item: plain },
    Timeline: { ...plain, Item: plain },
    Pagination: plain,
    Checkbox: {
      props: ['checked'],
      emits: ['update:checked'],
      template: `<input type="checkbox" :checked="checked" @change="$emit('update:checked', $event.target.checked)" />`,
    },
    Input: {
      TextArea: textarea,
      props: ['value'],
      emits: ['update:value'],
      template: `<input :value="value" @input="$emit('update:value', $event.target.value)" />`,
    },
    Select: {
      props: ['value', 'options'],
      emits: ['update:value'],
      template: `<select :value="value" @change="$emit('update:value', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>`,
    },
    Modal: {
      props: ['open', 'title', 'footer'],
      emits: ['ok'],
      template: `<section v-if="open"><h3>{{ title }}</h3><slot /><button v-if="footer !== null" @click="$emit('ok')">确认</button></section>`,
    },
    Table: {
      props: ['columns', 'dataSource'],
      template: `<div><article v-for="record in dataSource" :key="record.id"><div v-for="column in columns" :key="column.key || column.dataIndex"><span>{{ record[column.dataIndex] }}</span><slot name="bodyCell" :record="record" :column="column" /></div></article></div>`,
    },
    message: mocks.notify,
  };
});

const scope = { tenantId: 'tenant', orgId: 'org' };
const initial = {
  ...scope,
  id: 'ticket-1',
  title: '授权客服工单',
  optimisticLock: 6,
  status: 'Assigned',
  supportEventsByCurrentStatus: ['分派', '开始处理'],
  actionLog: [],
};
const wrappers: ReturnType<typeof mount>[] = [];
function button(wrapper: ReturnType<typeof mount>, label: string) {
  const target = wrapper
    .findAll('button')
    .find((item) => item.text() === label);
  if (!target) throw new Error(`按钮不存在：${label}`);
  return target;
}
function hasButton(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').some((item) => item.text() === label);
}
async function openScopedTicket() {
  const wrapper = mount(TicketPage);
  wrappers.push(wrapper);
  await flushPromises();
  await button(wrapper, '选择范围').trigger('click');
  await flushPromises();
  await button(wrapper, '查看工单').trigger('click');
  await flushPromises();
  return wrapper;
}

describe('工单工作台授权交互阳性合同', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.userInfo = { platformUser: true, tenantId: 'tenant' };
    mocks.route.query = {};
    mocks.allowed = new Set([
      'assign',
      'attachmentDownload',
      'list',
      'message',
      'messages',
      'reopen',
      'retrieve',
      'start',
    ]);
    mocks.enums.mockImplementation(async (name: string) =>
      name.endsWith('TicketStatus')
        ? [
            { label: '已分派', value: 'Assigned' },
            { label: '处理中', value: 'InProgress' },
            { label: '已解决', value: 'Resolved' },
          ]
        : [{ label: '收到邮件', value: 'InboundEmail' }],
    );
    mocks.ticket.list.mockResolvedValue({ items: [{ ...initial }], totals: 1 });
    mocks.ticket.retrieve.mockResolvedValue({ ...initial });
    mocks.ticket.messages.mockResolvedValue({ items: [], totals: 0 });
    mocks.users.mockResolvedValue({
      items: [{ id: 'handler-1', realName: '授权处理人' }],
    });
  });
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('无默认租户时先引导选择受理组织，选择后才查询工单', async () => {
    mocks.userInfo = { platformUser: true, tenantId: '' };
    const wrapper = mount(TicketPage);
    wrappers.push(wrapper);
    await flushPromises();

    expect(mocks.ticket.list).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('请选择受理组织后查询客服工单');
    expect(button(wrapper, '选择范围').attributes('data-placeholder')).toBe(
      '请选择受理组织',
    );

    await button(wrapper, '选择范围').trigger('click');
    await flushPromises();
    expect(mocks.ticket.list).toHaveBeenCalledExactlyOnceWith({
      ...scope,
      status: undefined,
      pageIndex: 1,
      pageSize: 20,
    });
    expect(wrapper.text()).not.toContain('请选择受理组织后查询客服工单');
  });

  it('有默认租户时继续查询当前租户，不强制选择组织', async () => {
    mocks.userInfo = { platformUser: false, tenantId: 'tenant' };
    const wrapper = mount(TicketPage);
    wrappers.push(wrapper);
    await flushPromises();

    expect(mocks.ticket.list).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).not.toContain('请选择受理组织后查询客服工单');
  });

  it.each([true, false])(
    '分派目录按主体查询，提交选定处理人及范围版本并重新读取 platform=%s',
    async (platformUser) => {
      mocks.userInfo = { platformUser, tenantId: 'tenant' };
      const wrapper = await openScopedTicket();
      await button(wrapper, '分派').trigger('click');
      const select = wrapper.get('section select');
      await select.trigger('focus');
      await flushPromises();
      expect(mocks.users).toHaveBeenCalledWith({
        ...(platformUser ? { tenantId: 'tenant' } : {}),
        orgId: 'org',
        orgIdList: ['org'],
        enable: true,
        containsName: '',
        pageIndex: 1,
        pageSize: 100,
      });
      expect(select.text()).toContain('授权处理人');
      await select.setValue('handler-1');
      await wrapper.get('textarea').setValue('转交当前可用处理人');
      mocks.ticket.retrieve.mockResolvedValue({
        ...initial,
        optimisticLock: 7,
        actionLog: [
          {
            occurTime: '2026-10-07T10:00:00',
            operator: '客服管理员',
            action: '分派',
            beforeStatus: 'Assigned',
            afterStatus: 'Assigned',
            remark: '分派已记录',
          },
        ],
      });
      await button(wrapper, '确认').trigger('click');
      await flushPromises();
      expect(mocks.ticket.assign).toHaveBeenCalledWith({
        id: 'ticket-1',
        ...scope,
        optimisticLock: 6,
        assigneeId: 'handler-1',
        remark: '转交当前可用处理人',
      });
      expect(mocks.ticket.retrieve).toHaveBeenLastCalledWith({
        id: 'ticket-1',
        ...scope,
      });
      expect(mocks.ticket.retrieve).toHaveBeenCalledTimes(2);
      expect(mocks.ticket.messages).toHaveBeenCalledTimes(2);
      expect(wrapper.text()).toContain('分派已记录');
      expect(mocks.ticket.list).toHaveBeenCalledTimes(3);
    },
  );

  it.each([
    {
      method: 'start' as const,
      label: '开始处理',
      beforeStatus: 'Assigned',
      afterStatus: 'InProgress',
    },
    {
      method: 'reopen' as const,
      label: '重开',
      beforeStatus: 'Resolved',
      afterStatus: 'InProgress',
    },
  ])(
    '$label刷新服务端日志与支持事件，后续分派使用新版本',
    async ({ method, label, beforeStatus, afterStatus }) => {
      mocks.ticket.retrieve.mockResolvedValue({
        ...initial,
        status: beforeStatus,
        supportEventsByCurrentStatus: [label],
      });
      const wrapper = await openScopedTicket();
      expect(hasButton(wrapper, label)).toBe(true);
      await button(wrapper, label).trigger('click');
      await wrapper.get('textarea').setValue('请求继续处理');
      mocks.ticket.retrieve.mockResolvedValue({
        ...initial,
        status: afterStatus,
        optimisticLock: 7,
        supportEventsByCurrentStatus: ['分派'],
        actionLog: [
          {
            occurTime: '2026-10-07T10:00:00',
            operator: '处理人',
            action: label,
            beforeStatus,
            afterStatus,
            remark: '服务端最新日志',
          },
        ],
      });
      await button(wrapper, '确认').trigger('click');
      await flushPromises();
      expect(mocks.ticket[method]).toHaveBeenCalledWith({
        id: 'ticket-1',
        ...scope,
        optimisticLock: 6,
        remark: '请求继续处理',
      });
      expect(hasButton(wrapper, label)).toBe(false);
      expect(wrapper.text()).toContain('服务端最新日志');
      expect(wrapper.text()).toContain('处理中');
      expect(mocks.ticket.retrieve).toHaveBeenCalledTimes(2);
      expect(mocks.ticket.messages).toHaveBeenCalledTimes(2);
      await button(wrapper, '分派').trigger('click');
      const select = wrapper.get('section select');
      await select.trigger('focus');
      await flushPromises();
      await select.setValue('handler-1');
      await button(wrapper, '确认').trigger('click');
      await flushPromises();
      expect(mocks.ticket.assign).toHaveBeenCalledWith({
        id: 'ticket-1',
        ...scope,
        optimisticLock: 7,
        assigneeId: 'handler-1',
        remark: undefined,
      });
    },
  );

  it('会话分页摘要按文本显示，全文与私有附件请求绑定当前工单和作用域', async () => {
    mocks.ticket.messages.mockResolvedValue({
      items: [
        {
          id: 'message-1',
          direction: 'InboundEmail',
          body: '邮件摘要',
          bodyTruncated: true,
          attachmentFileIds: ['private-blob'],
          sourceInboxId: 'inbox-1',
        },
      ],
      totals: 1,
    });
    mocks.ticket.message.mockResolvedValue({
      id: 'message-1',
      body: '<script>不执行的邮件全文</script>',
    });
    const blob = new Blob(['私有附件']);
    mocks.ticket.attachmentDownload.mockResolvedValue({
      blob,
      fileName: '会话附件.txt',
    });
    const create = vi.fn(() => 'blob:private-test');
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      Object.assign(class extends URL {}, {
        createObjectURL: create,
        revokeObjectURL: revoke,
      }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const wrapper = await openScopedTicket();
    expect(mocks.ticket.messages).toHaveBeenCalledWith({
      id: 'ticket-1',
      ...scope,
      pageIndex: 1,
      pageSize: 20,
    });
    expect(wrapper.text()).toContain('邮件摘要');
    await button(wrapper, '查看完整消息').trigger('click');
    await flushPromises();
    expect(mocks.ticket.message).toHaveBeenCalledWith({
      id: 'ticket-1',
      ...scope,
      messageId: 'message-1',
    });
    expect(wrapper.text()).toContain('<script>不执行的邮件全文</script>');
    expect(wrapper.find('script').exists()).toBe(false);
    await button(wrapper, '下载会话附件 1').trigger('click');
    await flushPromises();
    expect(mocks.ticket.attachmentDownload).toHaveBeenCalledWith({
      id: 'ticket-1',
      ...scope,
      blobId: 'private-blob',
    });
    expect(create).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.instances[0]).toHaveProperty('download', '会话附件.txt');
    expect(revoke).toHaveBeenCalledWith('blob:private-test');
    await button(wrapper, '查看来源邮件').trigger('click');
    expect(mocks.push).toHaveBeenCalledWith({
      path: '/clob/V1/Inbox',
      query: { id: 'inbox-1' },
    });
    expect(mocks.ticket.start).not.toHaveBeenCalled();
    expect(mocks.ticket.reply).not.toHaveBeenCalled();
  });

  it.each(['无支持事件', '无方法权限'])(
    '%s时不提供状态动作，附件撤权后不请求私有文件',
    async (reason) => {
      if (reason === '无支持事件')
        mocks.ticket.retrieve.mockResolvedValue({
          ...initial,
          supportEventsByCurrentStatus: [],
        });
      else {
        mocks.allowed.delete('assign');
        mocks.allowed.delete('start');
        mocks.allowed.delete('reopen');
      }
      mocks.allowed.delete('attachmentDownload');
      mocks.ticket.messages.mockResolvedValue({
        items: [
          {
            id: 'message-1',
            body: '摘要',
            attachmentFileIds: ['private-blob'],
          },
        ],
        totals: 1,
      });
      const wrapper = await openScopedTicket();
      for (const label of ['分派', '开始处理', '重开'])
        expect(hasButton(wrapper, label)).toBe(false);
      expect(
        button(wrapper, '下载会话附件 1').attributes('disabled'),
      ).toBeDefined();
      await button(wrapper, '下载会话附件 1').trigger('click');
      for (const method of [
        'assign',
        'start',
        'reopen',
        'attachmentDownload',
      ] as const)
        expect(mocks.ticket[method]).not.toHaveBeenCalled();
    },
  );

  it('操作弹窗打开后撤销方法权限，确认也不发送状态命令', async () => {
    const wrapper = await openScopedTicket();
    await button(wrapper, '开始处理').trigger('click');
    mocks.allowed.delete('start');
    await button(wrapper, '确认').trigger('click');
    await flushPromises();
    expect(mocks.ticket.start).not.toHaveBeenCalled();
    expect(mocks.ticket.retrieve).toHaveBeenCalledTimes(1);
  });
});
