import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RulePage from '../views/support-mailbox-rule/index.vue';

// Component contract tests with service stubs only; no runtime mail or supplier fixture.
const mocks = vi.hoisted(() => ({
  allowed: new Set<string>(),
  error: vi.fn(),
  success: vi.fn(),
  rules: {
    list: vi.fn(),
    retrieve: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  },
  queues: { list: vi.fn() },
  users: { list: vi.fn() },
  sources: vi.fn(),
  enums: vi.fn(),
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({
    userInfo: { platformUser: false, tenantId: 'tenant-a' },
  }),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue',
  async () => {
    const { defineComponent } = await import('vue');
    return {
      default: defineComponent({
        props: { config: { type: Object, required: true } },
        data: () => ({ rows: [] as Record<string, unknown>[] }),
        mounted() {
          void this.reload();
        },
        methods: {
          async reload() {
            const result = await this.config.apiService.list({
              pageIndex: 1,
              pageSize: 20,
            });
            this.rows = result.items;
          },
        },
        template: `<main>
          <div data-query><slot name="search-field-orgId" /></div>
          <div data-toolbar><slot name="toolbar-extra" :is-list-operation-visible="() => true" /></div>
          <div v-for="record in rows" :key="record.id">
            <span v-for="field in config.fields.filter(item => item.table)" :key="field.key">{{ field.tableValue ? field.tableValue(record) : record[field.key] }}</span>
            <slot name="row-actions" :record="record" />
          </div>
        </main>`,
      }),
    };
  },
);
vi.mock('../api/support-mailbox-rule-service', () => ({
  supportMailboxRuleService: mocks.rules,
}));
vi.mock('../api/ticket-queue-service', () => ({
  ticketQueueService: mocks.queues,
}));
vi.mock('../api/user-service', () => ({ userService: mocks.users }));
vi.mock('../views/api-module', () => ({
  moduleFetchOptions: mocks.sources,
  moduleFetchEnumOptions: mocks.enums,
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({
    hasPermission: (permissions: string[]) =>
      permissions.every((key) => mocks.allowed.has(key)),
  }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
vi.mock('../views/support-scope-selector.vue', () => ({
  default: {
    name: 'SupportScopeSelectorStub',
    props: ['modelValue'],
    emits: ['change'],
    template: `<div :data-selected="modelValue?.id"><button @click="$emit('change', { kind: 'org', id: 'org-a', tenantId: 'tenant-a' })">Scope A</button><button @click="$emit('change', { kind: 'org', id: 'org-b', tenantId: 'tenant-a' })">Scope B</button></div>`,
  },
}));
vi.mock('ant-design-vue', () => {
  const plain = { template: '<div><slot /></div>' };
  const field = {
    props: ['label'],
    template: '<div :data-field="label"><slot /></div>',
  };
  return {
    Alert: { props: ['message'], template: '<p>{{ message }}</p>' },
    Button: {
      props: ['disabled'],
      emits: ['click'],
      template: `<button :disabled="disabled" @click="$emit('click')"><slot /></button>`,
    },
    Input: {
      props: ['value', 'placeholder'],
      emits: ['update:value'],
      template: `<input :value="value" :placeholder="placeholder" @input="$emit('update:value', $event.target.value)" />`,
    },
    Select: {
      props: ['value', 'options', 'placeholder'],
      emits: ['update:value', 'change', 'focus'],
      template: `<select :value="value" :placeholder="placeholder" @focus="$emit('focus')" @change="$emit('update:value', $event.target.value); $emit('change', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>`,
    },
    Form: { ...plain, Item: field },
    Descriptions: { ...plain, Item: field },
    Tag: plain,
    Modal: {
      props: ['open', 'title', 'footer'],
      emits: ['ok'],
      template: `<section v-if="open" :data-modal="title"><h3>{{ title }}</h3><slot /><button v-if="footer !== null" @click="$emit('ok')">Confirm</button></section>`,
    },
    Table: {
      props: ['columns', 'dataSource'],
      template: `<div><div v-for="record in dataSource" :key="record.id"><div v-for="column in columns" :key="column.key || column.dataIndex"><span>{{ record[column.dataIndex] }}</span><slot name="bodyCell" :column="column" :record="record" /></div></div></div>`,
    },
    message: { error: mocks.error, success: mocks.success },
  };
});
function button(wrapper: ReturnType<typeof mount>, text: string) {
  const control = wrapper
    .findAll('button')
    .find((item) => item.text() === text);
  if (!control) throw new Error(`Missing button: ${text}`);
  return control;
}
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const scope = { tenantId: 'tenant-a', orgId: 'org-a' };
const domain = {
  label: 'unit.invalid',
  value: 'domain-a',
  tenantId: 'tenant-a',
  enable: true,
  lifecycleStatus: 'Active',
  emailReceivingEnabled: true,
};
const relay = {
  label: 'Relay unit source',
  value: 'relay-a',
  tenantId: 'tenant-a',
  enable: true,
  syncStatus: 'Synced',
  providerRouteId: 'provider-route-a',
};
const existing = {
  id: 'rule-a',
  ...scope,
  optimisticLock: 7,
  enabled: false,
  email: 'support@unit.invalid',
  inboundChannel: 'LocalSmtp',
  mailDomainId: 'domain-a',
  queueId: 'queue-a',
  defaultPriority: 'Normal',
  defaultOrgId: 'org-a',
};
async function scopedPage() {
  const wrapper = mount(RulePage);
  await flushPromises();
  expect(wrapper.get('[data-query]').text()).toContain('Scope A');
  expect(wrapper.get('[data-toolbar]').text()).not.toContain('Scope A');
  await button(wrapper, 'Scope A').trigger('click');
  await flushPromises();
  return wrapper;
}
function field(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.get(`[data-field="${label}"] select`);
}
async function fillCreate(wrapper: ReturnType<typeof mount>, open = true) {
  if (open) await button(wrapper, '创建受理邮箱').trigger('click');
  await flushPromises();
  await wrapper
    .get('input[placeholder="support@example.com"]')
    .setValue('support@unit.invalid');
  await field(wrapper, '入站通道').setValue('LocalSmtp');
  await flushPromises();
  await field(wrapper, '收件域名').trigger('focus');
  await field(wrapper, '受理队列').trigger('focus');
  await field(wrapper, '默认处理人').trigger('focus');
  await flushPromises();
  await field(wrapper, '收件域名').setValue('domain-a');
  await field(wrapper, '受理队列').setValue('queue-a');
  await field(wrapper, '默认处理人').setValue('user-a');
  await field(wrapper, '默认优先级').setValue('Normal');
}
describe('support mailbox rule positive component contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.allowed = new Set([
      'create',
      'disable',
      'enable',
      'list',
      'retrieve',
      'update',
    ]);
    mocks.rules.list.mockResolvedValue({ items: [], totals: 0 });
    mocks.rules.retrieve.mockResolvedValue(existing);
    mocks.rules.create.mockResolvedValue({ ...existing, optimisticLock: 0 });
    mocks.rules.update.mockResolvedValue({ ...existing, optimisticLock: 8 });
    mocks.rules.enable.mockResolvedValue({
      ...existing,
      enabled: true,
      optimisticLock: 9,
    });
    mocks.queues.list.mockResolvedValue({
      items: [
        {
          id: 'queue-a',
          name: 'Enabled queue',
          code: 'support',
          enabled: true,
        },
        { id: 'disabled-queue', enabled: false },
      ],
      totals: 2,
    });
    mocks.users.list.mockResolvedValue({
      items: [{ id: 'user-a', realName: 'Authorized handler' }],
    });
    mocks.sources.mockImplementation(async (path: string) =>
      path === '/Domain/list' ? [domain] : [relay],
    );
    mocks.enums.mockImplementation(async (name: string) =>
      name.endsWith('$InboundChannel')
        ? [
            { label: 'Local SMTP', value: 'LocalSmtp' },
            { label: 'Forward Email', value: 'ForwardEmail' },
          ]
        : [{ label: 'Normal', value: 'Normal' }],
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('chooses creation ownership in the modal without requiring a list filter', async () => {
    const wrapper = mount(RulePage);
    await flushPromises();
    expect(
      button(wrapper, '创建受理邮箱').attributes('disabled'),
    ).toBeUndefined();
    await button(wrapper, '创建受理邮箱').trigger('click');
    const modal = wrapper.get('[data-modal="创建受理邮箱"]');
    expect(modal.find('[data-field="受理组织"]').exists()).toBe(true);
    await button(wrapper, 'Confirm').trigger('click');
    expect(mocks.rules.create).not.toHaveBeenCalled();
    await modal.get('[data-field="受理组织"] button').trigger('click');
    await fillCreate(wrapper, false);
    await button(wrapper, 'Confirm').trigger('click');
    await flushPromises();
    expect(mocks.rules.create).toHaveBeenCalledWith(
      expect.objectContaining(scope),
    );
  });

  it('uses the modal organization instead of the current list filter', async () => {
    const wrapper = await scopedPage();
    await button(wrapper, '创建受理邮箱').trigger('click');
    await flushPromises();
    const modalScopeB = wrapper.get(
      '[data-modal="创建受理邮箱"] [data-field="受理组织"] button:nth-child(2)',
    );
    expect(modalScopeB.text()).toBe('Scope B');
    await modalScopeB.trigger('click');
    const selectors = wrapper.findAllComponents({
      name: 'SupportScopeSelectorStub',
    });
    expect(selectors[1]?.emitted('change')?.at(-1)?.[0]).toMatchObject({
      id: 'org-b',
    });
    await flushPromises();
    expect(
      wrapper
        .get('[data-modal="创建受理邮箱"] [data-field="受理组织"] > div')
        .attributes('data-selected'),
    ).toBe('org-b');
    await fillCreate(wrapper, false);
    await button(wrapper, 'Confirm').trigger('click');
    await flushPromises();
    expect(mocks.rules.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        orgId: 'org-b',
        config: expect.objectContaining({ defaultOrgId: 'org-b' }),
      }),
    );
    expect(mocks.queues.list).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-b', tenantId: 'tenant-a' }),
    );
  });

  it('discards stale modal candidates when creation ownership changes', async () => {
    const wrapper = await scopedPage();
    await button(wrapper, '创建受理邮箱').trigger('click');
    await flushPromises();
    await field(wrapper, '入站通道').setValue('LocalSmtp');
    const old = deferred<Record<string, unknown>[]>();
    mocks.sources.mockReturnValueOnce(old.promise);
    await field(wrapper, '收件域名').trigger('focus');
    await wrapper
      .get(
        '[data-modal="创建受理邮箱"] [data-field="受理组织"] button:nth-child(2)',
      )
      .trigger('click');
    await field(wrapper, '收件域名').trigger('focus');
    await flushPromises();
    old.resolve([{ ...domain, label: 'Old organization source' }]);
    await flushPromises();
    expect(field(wrapper, '收件域名').text()).not.toContain(
      'Old organization source',
    );
    expect(field(wrapper, '收件域名').text()).toContain('unit.invalid');
  });

  it('creates a disabled rule from selected valid source and queue with immutable organization ownership', async () => {
    const wrapper = await scopedPage();
    await fillCreate(wrapper);
    expect(
      field(wrapper, '受理队列')
        .findAll('option')
        .map((item) => item.attributes('value')),
    ).toEqual(['queue-a']);
    await button(wrapper, 'Confirm').trigger('click');
    await flushPromises();
    expect(mocks.rules.create).toHaveBeenCalledTimes(1);
    expect(mocks.rules.create).toHaveBeenCalledWith({
      ...scope,
      config: {
        email: 'support@unit.invalid',
        inboundChannel: 'LocalSmtp',
        queueId: 'queue-a',
        defaultPriority: 'Normal',
        mailDomainId: 'domain-a',
        emailRelayRouteId: undefined,
        defaultAssigneeId: 'user-a',
        defaultOrgId: 'org-a',
        outboundConfigRef: undefined,
      },
    });
    expect(mocks.rules.enable).not.toHaveBeenCalled();
    expect(mocks.rules.update).not.toHaveBeenCalled();
  });

  it('updates only configuration using retrieved identity/version then enables through its separate command with the refreshed version', async () => {
    mocks.rules.list.mockResolvedValue({ items: [existing], totals: 1 });
    const wrapper = await scopedPage();
    await button(wrapper, '修改').trigger('click');
    await flushPromises();
    expect(mocks.rules.retrieve).toHaveBeenCalledWith({
      ...scope,
      id: 'rule-a',
    });
    await wrapper
      .get('input[placeholder="support@example.com"]')
      .setValue('changed@unit.invalid');
    mocks.rules.list.mockResolvedValue({
      items: [
        { ...existing, email: 'changed@unit.invalid', optimisticLock: 8 },
      ],
      totals: 1,
    });
    await button(wrapper, 'Confirm').trigger('click');
    await flushPromises();
    expect(mocks.rules.update).toHaveBeenCalledWith({
      ...scope,
      id: 'rule-a',
      optimisticLock: 7,
      config: {
        email: 'changed@unit.invalid',
        inboundChannel: 'LocalSmtp',
        queueId: 'queue-a',
        defaultPriority: 'Normal',
        mailDomainId: 'domain-a',
        emailRelayRouteId: undefined,
        defaultAssigneeId: undefined,
        defaultOrgId: 'org-a',
        outboundConfigRef: undefined,
      },
    });
    expect(mocks.rules.enable).not.toHaveBeenCalled();
    mocks.rules.list.mockResolvedValue({
      items: [{ ...existing, enabled: true, optimisticLock: 9 }],
      totals: 1,
    });
    await button(wrapper, '启用').trigger('click');
    await flushPromises();
    expect(mocks.rules.enable).toHaveBeenCalledWith({
      ...scope,
      id: 'rule-a',
      optimisticLock: 8,
    });
    expect(wrapper.text()).toContain('已启用');
    expect(mocks.rules.create).not.toHaveBeenCalled();
  });

  it('ignores an older source lookup after changing inbound channel and does not save both source kinds', async () => {
    const wrapper = await scopedPage();
    await button(wrapper, '创建受理邮箱').trigger('click');
    const old = deferred<Record<string, unknown>[]>();
    mocks.sources.mockReturnValueOnce(old.promise);
    await field(wrapper, '入站通道').setValue('LocalSmtp');
    await field(wrapper, '收件域名').trigger('focus');
    await field(wrapper, '入站通道').setValue('ForwardEmail');
    await field(wrapper, '中转路由').trigger('focus');
    await flushPromises();
    old.resolve([{ ...domain, label: 'Old channel source' }]);
    await flushPromises();
    expect(field(wrapper, '中转路由').text()).toContain('Relay unit source');
    expect(field(wrapper, '中转路由').text()).not.toContain(
      'Old channel source',
    );
    expect(mocks.rules.create).not.toHaveBeenCalled();
  });

  it('ignores old source and detail responses after changing organization', async () => {
    mocks.rules.list.mockResolvedValue({ items: [existing], totals: 1 });
    const wrapper = await scopedPage();
    const oldDetail = deferred<typeof existing>();
    mocks.rules.retrieve.mockReturnValueOnce(oldDetail.promise);
    await button(wrapper, '修改').trigger('click');
    await button(wrapper, 'Scope B').trigger('click');
    await flushPromises();
    oldDetail.resolve({ ...existing, email: 'stale@unit.invalid' });
    await flushPromises();
    expect(wrapper.find('[data-modal="支持邮箱配置"]').exists()).toBe(false);
    await button(wrapper, '创建受理邮箱').trigger('click');
    await field(wrapper, '入站通道').setValue('LocalSmtp');
    const oldSource = deferred<Record<string, unknown>[]>();
    mocks.sources.mockReturnValueOnce(oldSource.promise);
    await field(wrapper, '收件域名').trigger('focus');
    await button(wrapper, 'Scope A').trigger('click');
    await button(wrapper, '创建受理邮箱').trigger('click');
    await field(wrapper, '入站通道').setValue('LocalSmtp');
    await field(wrapper, '收件域名').trigger('focus');
    await flushPromises();
    oldSource.resolve([{ ...domain, label: 'Old organization source' }]);
    await flushPromises();
    expect(field(wrapper, '收件域名').text()).not.toContain(
      'Old organization source',
    );
    expect(field(wrapper, '收件域名').text()).toContain('unit.invalid');
    expect(mocks.rules.update).not.toHaveBeenCalled();
  });
});
