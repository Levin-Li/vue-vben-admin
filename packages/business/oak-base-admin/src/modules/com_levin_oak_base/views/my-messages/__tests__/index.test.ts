import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MyMessagesPage from '../index.vue';

const {
  list,
  retrieve,
  unreadCount,
  markRead,
  push,
  myDetail,
  replace,
  context,
} = vi.hoisted(() => ({
  list: vi.fn(),
  retrieve: vi.fn(),
  unreadCount: vi.fn(),
  markRead: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  myDetail: vi.fn(),
  context: {
    route: { query: {} as Record<string, unknown> },
    accessToken: 'token',
    userInfo: { id: 'user-1', tenantId: 'tenant-1' },
  },
}));

vi.mock('../../../api/user-message-service', () => ({
  userMessageService: { list, retrieve, unreadCount, markRead },
}));
vi.mock('vue-router', async () => {
  const { reactive } = await vi.importActual<typeof import('vue')>('vue');
  context.route = reactive(context.route);
  return {
    useRouter: () => ({ push, replace }),
    useRoute: () => context.route,
  };
});
vi.mock('@vben/runtime/stores', async () => {
  const { reactive } = await vi.importActual<typeof import('vue')>('vue');
  const state = reactive(context);
  return { useAccessStore: () => state, useUserStore: () => state };
});
vi.mock('../../../api/notice-service', () => ({ noticeService: { myDetail } }));
enableAutoUnmount(afterEach);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<div><slot /></div>' },
}));
vi.mock('ant-design-vue', () => ({
  Alert: { props: ['message'], template: '<div>{{ message }}<slot /></div>' },
  Button: {
    emits: ['click'],
    props: ['disabled'],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  Checkbox: {
    props: ['checked'],
    template:
      '<input type="checkbox" :checked="checked" @change="$emit(\'change\', { target: { checked: $event.target.checked } })" />',
  },
  Empty: { template: '<div>暂无消息</div>' },
  Modal: {
    props: ['open'],
    template: '<div v-if="open"><slot /></div>',
  },
  Pagination: { template: '<div />' },
  Spin: { template: '<div><slot /></div>' },
  Tag: { template: '<span><slot /></span>' },
  message: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

const firstMessage = {
  id: 'message-1',
  title: '收到新邮件',
  summary: '安全摘要',
  sourceId: 'mail-1',
  sourceType: 'Inbox',
  createTime: '2026-10-06T18:00:00',
  readTime: null,
};

function getButton(wrapper: ReturnType<typeof mountPage>, label: string) {
  const button = wrapper
    .findAll('button')
    .find((item) => item.text() === label);
  if (!button) throw new Error(`按钮不存在：${label}`);
  return button;
}

function mountPage() {
  return mount(MyMessagesPage);
}

describe('我的消息页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.route.query = {};
    context.accessToken = 'token';
    context.userInfo = reactive({ id: 'user-1', tenantId: 'tenant-1' });
    myDetail.mockResolvedValue({
      id: 'notice-1',
      title: '本人公告',
      contentType: 'Text',
      content: '本人可读正文',
    });
    list.mockResolvedValue({
      items: [firstMessage],
      pageIndex: 1,
      pageSize: 20,
      totals: 1,
    });
    retrieve.mockResolvedValue(firstMessage);
    unreadCount.mockResolvedValue(1);
    markRead.mockResolvedValue(undefined);
  });

  it('以服务端未读筛选和分页加载，切换全部时重新查询', async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(list).toHaveBeenCalledWith({
      pageIndex: 1,
      pageSize: 20,
      unreadOnly: true,
    });
    await getButton(wrapper, '全部').trigger('click');
    await flushPromises();
    expect(list).toHaveBeenLastCalledWith({
      pageIndex: 1,
      pageSize: 20,
      unreadOnly: false,
    });
  });

  it('较早的未读查询后返回时不能覆盖已切换的全部列表', async () => {
    let resolveUnread!: (value: unknown) => void;
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUnread = resolve;
        }),
    );
    const wrapper = mountPage();
    await getButton(wrapper, '全部').trigger('click');
    await flushPromises();
    resolveUnread({
      items: [{ ...firstMessage, title: '过期结果' }],
      totals: 1,
      pageIndex: 1,
    });
    await flushPromises();
    expect(wrapper.text()).toContain('收到新邮件');
    expect(wrapper.text()).not.toContain('过期结果');
  });

  it('查看详情重新授权读取，不自动标记已读，并且仅展示摘要', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await getButton(wrapper, '查看').trigger('click');
    await flushPromises();
    expect(retrieve).toHaveBeenCalledWith('message-1');
    expect(markRead).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('安全摘要');
    expect(wrapper.text()).not.toContain('mail-1');
  });

  it('工作流真实摘要在列表为纯文本，在消息详情安全展示Markdown', async () => {
    const workflowMessage = {
      ...firstMessage,
      sourceType: 'Workflow',
      title: '采购审批通知',
      summary:
        '# 采购审批\n- **财务复核完成**\n\\[业务名称\\]\\(https://evil\\.example\\) A&B\n[查看说明](https://example.com/detail)\n<script>alert(1)</script>\n![跟踪](https://example.com/pixel)',
    };
    list.mockResolvedValue({
      items: [workflowMessage],
      totals: 1,
      pageIndex: 1,
    });
    retrieve.mockResolvedValue(workflowMessage);
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('财务复核完成');
    expect(wrapper.text()).not.toContain('# 采购审批');
    expect(wrapper.text()).not.toContain('**财务复核完成**');
    await getButton(wrapper, '查看').trigger('click');
    await flushPromises();
    expect(wrapper.get('h1').text()).toBe('采购审批');
    expect(wrapper.get('li strong').text()).toBe('财务复核完成');
    expect(wrapper.findAll('a')).toHaveLength(2);
    // 图片语法只变为安全链接文字，不加载远程资源；变量中的地址不可链接化。
    expect(wrapper.find('a[href="https://evil.example"]').exists()).toBe(false);
    expect(wrapper.find('a[href="https://example.com/detail"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('script').exists()).toBe(false);
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('[业务名称](https://evil.example) A&B');
    expect(wrapper.text()).not.toContain('&amp;');
  });

  it('普通消息摘要保持纯文本，不把Markdown样式作为可执行内容', async () => {
    const plain = { ...firstMessage, summary: '# **普通文本** A&B' };
    list.mockResolvedValue({ items: [plain], totals: 1, pageIndex: 1 });
    retrieve.mockResolvedValue(plain);
    const wrapper = mountPage();
    await flushPromises();
    await getButton(wrapper, '查看').trigger('click');
    await flushPromises();
    expect(wrapper.find('h1').exists()).toBe(false);
    expect(wrapper.get('p.whitespace-pre-wrap').find('strong').exists()).toBe(
      false,
    );
    expect(wrapper.get('p.whitespace-pre-wrap').text()).toBe(
      '# **普通文本** A&B',
    );
  });

  it('当前页选中后一次提交批量已读，不调用旧公告处理接口', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await getButton(wrapper, '批量已读').trigger('click');
    await flushPromises();
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead).toHaveBeenCalledWith({ ids: ['message-1'] });
  });

  it('收件来源只使用固定业务路由及受控标识查询，不拼接任意地址', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await getButton(wrapper, '查看').trigger('click');
    await flushPromises();
    await getButton(wrapper, '查看来源').trigger('click');
    expect(push).toHaveBeenCalledWith({
      path: '/clob/V1/Inbox',
      query: { id: 'mail-1' },
    });
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('mail-1'));
  });

  it.each([
    ['WorkflowTask', 'taskId'],
    ['WorkflowInstance', 'instanceId'],
  ])(
    '可信%s目标跳到固定工作流页面，不使用sourceId猜测',
    async (kind, parameter) => {
      const workflowMessage = {
        ...firstMessage,
        sourceType: 'Workflow',
        sourceId: 'instance-not-task',
        actionTarget: { kind, id: 'target+1' },
      };
      list.mockResolvedValue({
        items: [workflowMessage],
        pageIndex: 1,
        pageSize: 20,
        totals: 1,
      });
      retrieve.mockResolvedValue(workflowMessage);
      const wrapper = mountPage();
      await flushPromises();
      await getButton(wrapper, '查看').trigger('click');
      await flushPromises();
      await getButton(wrapper, '查看来源').trigger('click');
      expect(push).toHaveBeenCalledWith({
        path: '/clob/V1/MyWorkflow',
        query: { [parameter]: 'target+1' },
      });
      expect(markRead).not.toHaveBeenCalled();
    },
  );

  it('工作流目标缺失时保留摘要并禁用来源跳转', async () => {
    const workflowMessage = {
      ...firstMessage,
      sourceType: 'Workflow',
      sourceId: 'do-not-guess-task',
    };
    list.mockResolvedValue({
      items: [workflowMessage],
      pageIndex: 1,
      pageSize: 20,
      totals: 1,
    });
    retrieve.mockResolvedValue(workflowMessage);
    const wrapper = mountPage();
    await flushPromises();
    await getButton(wrapper, '查看').trigger('click');
    await flushPromises();
    expect(getButton(wrapper, '查看来源').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('安全摘要');
    expect(push).not.toHaveBeenCalled();
  });

  it('公告来源在个人页面按noticeId读取本人专用内容，不隐式已读', async () => {
    context.route.query = { noticeId: 'notice-1' };
    const wrapper = mountPage();
    await flushPromises();
    expect(myDetail).toHaveBeenCalledWith('notice-1');
    expect(wrapper.text()).toContain('本人可读正文');
    expect(markRead).not.toHaveBeenCalled();
  });

  it('公告来源失败清除上次正文并显示不可访问状态', async () => {
    context.route.query = { noticeId: 'notice-1' };
    const wrapper = mountPage();
    await flushPromises();
    myDetail.mockRejectedValueOnce(new Error('denied'));
    context.route.query = { noticeId: 'notice-2' };
    await flushPromises();
    expect(wrapper.text()).not.toContain('本人可读正文');
    expect(wrapper.text()).toContain('公告来源不可访问或已失效');
    expect(markRead).not.toHaveBeenCalled();
  });

  it('非法公告定位不调用来源API，旧异步响应不能覆盖新公告', async () => {
    context.route.query = { noticeId: ['notice-1', 'notice-2'] };
    const wrapper = mountPage();
    await flushPromises();
    expect(myDetail).not.toHaveBeenCalled();
    let resolveOld!: (value: unknown) => void;
    myDetail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    context.route.query = { noticeId: 'notice-old' };
    await flushPromises();
    myDetail.mockResolvedValueOnce({
      id: 'notice-new',
      contentType: 'Text',
      content: '本人可读正文',
    });
    context.route.query = { noticeId: 'notice-new' };
    await flushPromises();
    resolveOld({
      id: 'notice-old',
      contentType: 'Text',
      content: '旧公告不能显示',
    });
    await flushPromises();
    expect(wrapper.text()).toContain('本人可读正文');
    expect(wrapper.text()).not.toContain('旧公告不能显示');
  });

  it.each([
    null,
    { id: 'different-notice', contentType: 'Text', content: '不匹配来源正文' },
  ])('缺失或不一致公告来源响应不展示正文', async (response) => {
    context.route.query = { noticeId: 'notice-1' };
    myDetail.mockResolvedValue(response);
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('公告来源不可访问或已失效');
    expect(wrapper.text()).not.toContain('不匹配来源正文');
    expect(markRead).not.toHaveBeenCalled();
  });

  it('身份范围变化后清空旧公告并重新授权，不保留旧正文', async () => {
    context.route.query = { noticeId: 'notice-1' };
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('本人可读正文');
    myDetail.mockRejectedValueOnce(new Error('new-scope-denied'));
    context.userInfo.tenantId = 'tenant-2';
    await flushPromises();
    expect(myDetail).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain('本人可读正文');
    expect(wrapper.text()).toContain('公告来源不可访问或已失效');
    expect(markRead).not.toHaveBeenCalled();
  });

  it('公告来源只读HTML使用隔离viewer而非宿主v-html', async () => {
    context.route.query = { noticeId: 'notice-1' };
    myDetail.mockResolvedValue({
      id: 'notice-1',
      contentType: 'Html',
      content: '<script>parent.alert(1)</script>',
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find('iframe').attributes('sandbox')).toBe('');
    expect(wrapper.find('script').exists()).toBe(false);
    expect(markRead).not.toHaveBeenCalled();
  });

  it('未知来源隐藏可用导航，不执行服务端提供的地址', async () => {
    const unsafe = {
      ...firstMessage,
      sourceType: 'https://outside.example',
      sourceId: 'javascript:alert(1)',
    };
    list.mockResolvedValue({
      items: [unsafe],
      pageIndex: 1,
      pageSize: 20,
      totals: 1,
    });
    retrieve.mockResolvedValue(unsafe);
    const wrapper = mountPage();
    await flushPromises();
    await getButton(wrapper, '查看').trigger('click');
    await flushPromises();
    const sourceButton = getButton(wrapper, '查看来源');
    expect(sourceButton.attributes('disabled')).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });
});
