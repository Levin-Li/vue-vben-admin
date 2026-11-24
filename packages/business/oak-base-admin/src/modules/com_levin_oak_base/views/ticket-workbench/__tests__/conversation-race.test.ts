import { flushPromises, mount } from '@vue/test-utils';
import { Select } from 'ant-design-vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Workbench from '../workbench.vue';
import { ticketHelpContext } from '../help-context';

const mock = vi.hoisted(() => ({
  screenshot: vi.fn(),
  attachmentDownload: vi.fn(),
  createInternal: vi.fn(),
  markTicketRead: vi.fn(),
  queueChoices: vi.fn(),
  categoryOptions: vi.fn().mockResolvedValue([]),
  message: vi.fn(),
  workbench: vi.fn(),
  retrieve: vi.fn(),
  messages: vi.fn(),
  unreadTicketCounts: vi.fn(),
  tagOptions: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('../../../api/ticket-service', () => ({ ticketService: mock }));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: { id: 'me' } }),
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/clob/V1/MyTickets', query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@levin/admin-framework', () => ({ emitFrameworkEvent: vi.fn() }));
vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  notifyApiErrorOnce: mock.notify,
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({ buildApiMethodPermissions: () => [] }),
);
vi.mock('../../support-scope-selector.vue', () => ({
  default: {
    emits: ['change'],
    template:
      "<button @click=\"$emit('change', {kind: 'org', id: 'org', tenantId: 'tenant'})\">选择组织</button>",
  },
}));
vi.mock('../../support-user-selector.vue', () => ({
  default: { template: '<span />' },
}));

describe('工单会话异步隔离', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    ticketHelpContext.value = undefined;
  });

  it('每张工单显示个人未读数量，打开后刷新为已读', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const ticket = { id: 'a', title: '未读工单', status: 'New' };
    mock.workbench.mockResolvedValue({ items: [ticket], totals: 1 });
    mock.retrieve.mockResolvedValue(ticket);
    mock.messages.mockResolvedValue({
      items: [{ id: 'm', body: '消息', authorUserId: 'other' }],
      totals: 1,
    });
    mock.unreadTicketCounts
      .mockResolvedValueOnce({ a: 3 })
      .mockResolvedValueOnce({ a: 3 })
      .mockResolvedValue({});
    mock.markTicketRead.mockResolvedValue(undefined);
    mock.tagOptions.mockResolvedValue([]);
    const wrapper = mount(Workbench, {
      props: { mode: 'submitted' },
      global: { stubs: { SupportUserSelector: true, Modal: true } },
    });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[aria-label="3 条未读消息"]').text()).toBe('3');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('未读工单'))!
      .trigger('click');
    await flushPromises();
    expect(mock.markTicketRead).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', messageIds: ['m'] }),
    );
    expect(wrapper.find('[aria-label="3 条未读消息"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('已有处理人时显示转派和对应颜色状态', async () => {
    const ticket = {
      id: 'a',
      title: '已分派工单',
      status: 'Assigned',
      assigneeId: 'other',
      supportEventsByCurrentStatus: ['分派'],
    };
    mock.workbench.mockResolvedValue({ items: [ticket], totals: 1 });
    mock.retrieve.mockResolvedValue(ticket);
    mock.messages.mockResolvedValue({ items: [], totals: 0 });
    mock.unreadTicketCounts.mockResolvedValue({});
    mock.tagOptions.mockResolvedValue([]);
    const wrapper = mount(Workbench, {
      props: { mode: 'handling' },
      global: { stubs: { SupportUserSelector: true, Modal: true } },
    });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('已分派工单'))!
      .trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findAll('button')
        .some((button) => button.text().replace(/\s/g, '') === '转派'),
    ).toBe(true);
    expect(
      wrapper.find('.ticket-workbench__heading .ant-tag-blue').exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it('切换工单不会丢弃同一组织尚在加载的分类名称', async () => {
    let resolveCategories!: (
      value: Array<{ code: string; name: string }>,
    ) => void;
    mock.categoryOptions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCategories = resolve;
        }),
    );
    const ticket = {
      id: 'a',
      title: '分类工单',
      status: 'New',
      category: 'page',
    };
    mock.workbench.mockResolvedValue({ items: [ticket], totals: 1 });
    mock.retrieve.mockResolvedValue(ticket);
    mock.messages.mockResolvedValue({ items: [], totals: 0 });
    mock.unreadTicketCounts.mockResolvedValue({});
    mock.tagOptions.mockResolvedValue([]);
    const wrapper = mount(Workbench, {
      props: { mode: 'handling' },
      global: { stubs: { SupportUserSelector: true, Modal: true } },
    });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('分类工单'))!
      .trigger('click');
    await flushPromises();
    resolveCategories([{ code: 'page', name: '页面问题' }]);
    await flushPromises();
    expect(wrapper.text()).toContain('分类：页面问题');
    wrapper.unmount();
  });

  it('移除截图后预览消失，提交不再携带截图', async () => {
    mock.workbench.mockResolvedValue({ items: [], totals: 0 });
    mock.queueChoices.mockResolvedValue({ items: [], totals: 0 });
    mock.tagOptions.mockResolvedValue([]);
    mock.createInternal.mockResolvedValue('created');
    mock.retrieve.mockResolvedValue({
      id: 'created',
      title: '测试',
      status: 'New',
    });
    mock.messages.mockResolvedValue({ items: [], totals: 0 });
    mock.unreadTicketCounts.mockResolvedValue({});
    const modalStub = {
      name: 'Modal',
      props: ['open', 'title'],
      emits: ['ok'],
      template:
        '<section v-if="open"><slot/><button @click="$emit(\'ok\')">确认测试</button></section>',
    };
    const wrapper = mount(Workbench, {
      props: { mode: 'submitted' },
      global: { stubs: { SupportUserSelector: true, AModal: modalStub } },
    });
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('发起工单'))!
      .trigger('click');
    ticketHelpContext.value = {
      path: '/test',
      title: '测试页面',
      screenshotBase64: 'cG5n',
    };
    await flushPromises();
    expect(wrapper.find('img[alt="提交前截图预览"]').exists()).toBe(true);
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('移除截图'))!
      .trigger('click');
    expect(wrapper.find('img[alt="提交前截图预览"]').exists()).toBe(false);
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('选择组织'))!
      .trigger('click');
    await flushPromises();
    wrapper
      .findAllComponents(Select)
      .find((select) => select.props('placeholder') === '搜索受理小组')!
      .vm.$emit('update:value', 'queue');
    await wrapper
      .find('#ticket-workbench-create input.ant-input')
      .setValue('测试主题');
    await wrapper
      .find('#ticket-workbench-create textarea')
      .setValue('测试问题');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确认测试')!
      .trigger('click');
    await flushPromises();
    expect(mock.createInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '测试主题',
        body: '测试问题',
        screenshotBase64: undefined,
      }),
    );
    wrapper.unmount();
  });

  it('切换工单后忽略迟到的截图和全文响应', async () => {
    let resolveScreenshot!: (blob: Blob) => void;
    let resolveMessage!: (value: unknown) => void;
    mock.screenshot.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveScreenshot = resolve;
        }),
    );
    mock.message.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMessage = resolve;
        }),
    );
    const tickets = [
      { id: 'a', title: '工单甲', status: 'New' },
      { id: 'b', title: '工单乙', status: 'New' },
    ];
    mock.workbench.mockResolvedValue({ items: tickets, totals: 2 });
    mock.retrieve.mockImplementation(async ({ id }) =>
      tickets.find((ticket) => ticket.id === id),
    );
    mock.messages.mockImplementation(async ({ id }) => ({
      items:
        id === 'a'
          ? [
              {
                id: 'm',
                authorUserId: 'me',
                body: '原会话',
                bodyTruncated: true,
                attachmentFileIds: ['blob'],
              },
            ]
          : [],
      totals: id === 'a' ? 1 : 0,
    }));
    mock.unreadTicketCounts.mockResolvedValue({});
    mock.tagOptions.mockResolvedValue([]);
    const createUrl = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', {
      createObjectURL: createUrl,
      revokeObjectURL: vi.fn(),
    });
    const wrapper = mount(Workbench, {
      props: { mode: 'submitted' },
      global: { stubs: { SupportUserSelector: true, Modal: true } },
    });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('工单甲'))!
      .trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('查看截图'))!
      .trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('查看全文'))!
      .trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('工单乙'))!
      .trigger('click');
    await flushPromises();
    resolveScreenshot(new Blob(['old']));
    resolveMessage({ id: 'm', body: '迟到的旧内容' });
    await flushPromises();
    expect(wrapper.text()).not.toContain('原会话');
    expect(wrapper.text()).not.toContain('迟到的旧内容');
    expect(createUrl).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('邮件附件使用受控下载接口，并丢弃切换工单后的迟到响应', async () => {
    let resolveDownload!: (value: { blob: Blob; fileName: string }) => void;
    mock.attachmentDownload
      .mockResolvedValueOnce({
        blob: new Blob(['attachment']),
        fileName: 'test.txt',
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveDownload = resolve;
          }),
      );
    const tickets = [
      { id: 'a', title: '邮件工单', status: 'New' },
      { id: 'b', title: '另一工单', status: 'New' },
    ];
    mock.workbench.mockResolvedValue({ items: tickets, totals: 2 });
    mock.retrieve.mockImplementation(async ({ id }) =>
      tickets.find((ticket) => ticket.id === id),
    );
    mock.messages.mockImplementation(async ({ id }) => ({
      items:
        id === 'a'
          ? [
              {
                id: 'mail',
                body: '邮件正文',
                sourceInboxId: 'inbox',
                attachmentFileIds: ['attachment'],
              },
            ]
          : [],
      totals: id === 'a' ? 1 : 0,
    }));
    mock.unreadTicketCounts.mockResolvedValue({});
    mock.tagOptions.mockResolvedValue([]);
    const createUrl = vi.fn(() => 'blob:test');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: createUrl,
      revokeObjectURL: revokeUrl,
    });
    const clickDownload = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const wrapper = mount(Workbench, {
      props: { mode: 'submitted' },
      global: { stubs: { SupportUserSelector: true, Modal: true } },
    });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('邮件工单'))!
      .trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('下载附件 1'))!
      .trigger('click');
    expect(mock.attachmentDownload).toHaveBeenCalledWith({
      tenantId: 'tenant',
      orgId: 'org',
      id: 'a',
      blobId: 'attachment',
    });
    await flushPromises();
    expect(clickDownload).toHaveBeenCalledOnce();
    expect(revokeUrl).toHaveBeenCalledWith('blob:test');
    createUrl.mockClear();
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('下载附件 1'))!
      .trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('另一工单'))!
      .trigger('click');
    await flushPromises();
    resolveDownload({ blob: new Blob(['attachment']), fileName: 'test.txt' });
    await flushPromises();
    expect(createUrl).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
