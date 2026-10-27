import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InboxPage from '../views/inbox/index.vue';

// Component contract tests with service stubs only; no runtime mail or supplier fixture.
const mocks = vi.hoisted(() => ({
  allowed: new Set<string>(),
  error: vi.fn(),
  success: vi.fn(),
  route: { query: {} as Record<string, unknown> },
  push: vi.fn(),
  inbox: {
    list: vi.fn(),
    retrieve: vi.fn(),
    download: vi.fn(),
    intake: vi.fn(),
  },
  rules: { list: vi.fn() },
  makeUrl: vi.fn(),
  revokeUrl: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('../api/inbox-service', () => ({ inboxService: mocks.inbox }));
vi.mock('../api/support-mailbox-setting-service', () => ({
  supportMailboxSettingService: mocks.rules,
}));
// 标准 CRUD 在公共包已有独立测试；这里保留真实页面对列表作用域和扩展动作的组合契约。
vi.mock('../views/crud-page.vue', () => ({
  default: {
    name: 'CrudPageStub',
    props: ['config'],
    data: () => ({ rows: [] as Array<{ id: string }> }),
    async mounted() {
      const page = this as unknown as {
        config: {
          apiService: {
            list: (params: Record<string, unknown>) => Promise<{
              items?: Array<{ id: string }>;
            }>;
          };
          defaultQuery: Record<string, unknown>;
        };
        rows: Array<{ id: string }>;
      };
      const result = await page.config.apiService.list(
        page.config.defaultQuery,
      );
      page.rows = result.items || [];
    },
    template:
      '<main><div data-query><slot name="search-field-orgId" /></div><div data-toolbar><slot name="toolbar-extra" /></div><div v-for="record in rows" :key="record.id"><slot name="row-actions" :record="record" /></div></main>',
  },
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
    emits: ['change'],
    props: ['modelValue'],
    template: `<div><span v-if="modelValue">Current {{ modelValue.id }}</span><button @click="$emit('change', { kind: 'org', id: 'org-a', tenantId: 'tenant-a' })">Scope A</button><button @click="$emit('change', { kind: 'org', id: 'org-b', tenantId: 'tenant-a' })">Scope B</button></div>`,
  },
}));
vi.mock('ant-design-vue', () => {
  const plain = { template: '<div><slot /></div>' };
  const field = {
    props: ['label'],
    template: '<label :data-field="label"><slot /></label>',
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
const mail = {
  id: 'inbox-a',
  subject: 'Unit received message',
  fromEmail: 'sender@unit.invalid',
  recipientEmail: 'support@unit.invalid',
  textContent: 'Private body',
  messageIdHeader: '<message-a>',
  inReplyToHeader: '<parent-a>',
  referencesHeader: '<root-a> <parent-a>',
  rawMimeFileId: 'mime-a',
  attachmentFileIds: ['attachment-a'],
};
const mimeText =
  'Message-ID: <message-a>\r\nContent-Type: text/plain\r\n\r\nPrivate MIME body';
async function openMail() {
  const wrapper = mount(InboxPage);
  await flushPromises();
  expect(wrapper.get('[data-query]').text()).toContain('Scope A');
  expect(wrapper.get('[data-toolbar]').text()).not.toContain('Scope A');
  await button(wrapper, 'Scope A').trigger('click');
  await flushPromises();
  await button(wrapper, '原文与受理').trigger('click');
  await flushPromises();
  return wrapper;
}
describe('inbox positive component contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.allowed = new Set(['download', 'intake', 'list', 'retrieve']);
    mocks.route.query = {};
    mocks.inbox.list.mockResolvedValue({ items: [mail], totals: 1 });
    mocks.inbox.retrieve.mockResolvedValue(mail);
    mocks.inbox.download.mockResolvedValue({
      blob: new Blob([mimeText]),
      fileName: 'message.eml',
    });
    mocks.inbox.intake.mockResolvedValue('ticket-issued-by-server');
    mocks.rules.list.mockResolvedValue({
      items: [
        { id: 'matching', email: 'SUPPORT@unit.invalid', enabled: true },
        { id: 'disabled', email: 'support@unit.invalid', enabled: false },
        { id: 'other-address', email: 'other@unit.invalid', enabled: true },
      ],
      totals: 3,
    });
    mocks.makeUrl.mockReturnValue('blob:unit-private-download');
    const OriginalURL = URL;
    vi.stubGlobal(
      'URL',
      class extends OriginalURL {
        static override createObjectURL = mocks.makeUrl;
        static override revokeObjectURL = mocks.revokeUrl;
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the standard read-only CRUD list with the selected organization scope', async () => {
    const wrapper = mount(InboxPage);
    await flushPromises();
    const config = wrapper
      .getComponent({ name: 'CrudPageStub' })
      .props('config');
    expect(config).toMatchObject({
      allowCreate: false,
      allowDelete: false,
      allowEdit: false,
      allowRetrieve: true,
    });
    await button(wrapper, 'Scope A').trigger('click');
    await flushPromises();
    expect(mocks.inbox.list).toHaveBeenLastCalledWith({
      pageIndex: 1,
      pageSize: 20,
      ...scope,
    });
    expect(wrapper.text()).toContain('Current org-a');
  });

  it('shows conversation headers and previews MIME through the authorized binary service without making a download URL', async () => {
    const wrapper = await openMail();
    expect(mocks.inbox.retrieve).toHaveBeenLastCalledWith({
      id: mail.id,
      ...scope,
    });
    for (const header of [
      mail.messageIdHeader,
      mail.inReplyToHeader,
      mail.referencesHeader,
    ])
      expect(wrapper.text()).toContain(header);
    await button(wrapper, '查看原始 MIME').trigger('click');
    await flushPromises();
    expect(mocks.inbox.download).toHaveBeenLastCalledWith({
      id: mail.id,
      ...scope,
      blobId: 'mime-a',
    });
    expect(wrapper.get('[data-modal="原始 MIME 文本预览"]').text()).toContain(
      'Private MIME body',
    );
    expect(mocks.makeUrl).not.toHaveBeenCalled();
    expect(mocks.inbox.intake).not.toHaveBeenCalled();
  });

  it('downloads raw MIME and attachment bytes, uses the server filename and revokes each object URL', async () => {
    const wrapper = await openMail();
    const downloaded: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded.push(this.download);
    });
    await button(wrapper, '下载原始 MIME').trigger('click');
    await flushPromises();
    mocks.inbox.download.mockResolvedValueOnce({
      blob: new Blob(['Private attachment']),
      fileName: 'attachment.txt',
    });
    await button(wrapper, '下载附件 1').trigger('click');
    await flushPromises();
    expect(mocks.inbox.download.mock.calls.map(([params]) => params)).toEqual([
      { id: mail.id, ...scope, blobId: 'mime-a' },
      { id: mail.id, ...scope, blobId: 'attachment-a' },
    ]);
    expect(downloaded).toEqual(['message.eml', 'attachment.txt']);
    expect(mocks.makeUrl).toHaveBeenCalledTimes(2);
    expect(mocks.revokeUrl).toHaveBeenCalledTimes(2);
    expect(mocks.revokeUrl).toHaveBeenNthCalledWith(
      1,
      'blob:unit-private-download',
    );
    expect(mocks.revokeUrl).toHaveBeenNthCalledWith(
      2,
      'blob:unit-private-download',
    );
  });

  it('requires explicit matching rule selection and reuses the server ticket identity for a repeated intake', async () => {
    const wrapper = await openMail();
    expect(mocks.inbox.intake).not.toHaveBeenCalled();
    for (let attempt = 0; attempt < 2; attempt++) {
      await button(wrapper, '收件转工单').trigger('click');
      await flushPromises();
      const modal = wrapper.get('[data-modal="选择客服邮箱"]');
      expect(
        modal.findAll('option').map((item) => item.attributes('value')),
      ).toEqual(['matching']);
      await button(wrapper, 'Confirm').trigger('click');
      await flushPromises();
      expect(mocks.inbox.intake).toHaveBeenCalledTimes(attempt);
      await modal.get('select').setValue('matching');
      await button(wrapper, 'Confirm').trigger('click');
      await flushPromises();
    }
    expect(mocks.inbox.intake.mock.calls.map(([params]) => params)).toEqual([
      { id: mail.id, ...scope, supportMailboxSettingId: 'matching' },
      { id: mail.id, ...scope, supportMailboxSettingId: 'matching' },
    ]);
    expect(mocks.push.mock.calls.map(([target]) => target)).toEqual([
      { path: '/clob/V1/Ticket', query: { id: 'ticket-issued-by-server' } },
      { path: '/clob/V1/Ticket', query: { id: 'ticket-issued-by-server' } },
    ]);
  });

  it('does not restore a private MIME preview after the selected organization changes', async () => {
    const wrapper = await openMail();
    const response = deferred<{ blob: Blob; fileName: string }>();
    mocks.inbox.download.mockReturnValueOnce(response.promise);
    await button(wrapper, '查看原始 MIME').trigger('click');
    await button(wrapper, 'Scope B').trigger('click');
    await flushPromises();
    response.resolve({
      blob: new Blob(['Stale private MIME']),
      fileName: 'stale.eml',
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain('Stale private MIME');
    expect(wrapper.find('[data-modal="原始 MIME 文本预览"]').exists()).toBe(
      false,
    );
    expect(mocks.makeUrl).not.toHaveBeenCalled();
  });
});
