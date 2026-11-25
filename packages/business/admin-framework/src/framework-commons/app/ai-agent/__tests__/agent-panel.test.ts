import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import AgentPanel from '../agent-panel.vue';

const mocks = vi.hoisted(() => ({
  loadProviders: vi.fn(),
  runTurn: vi.fn(),
  configuration: vi.fn(),
}));

vi.mock('../chat', () => ({
  getAgentConfigurationComponent: mocks.configuration,
  loadAgentProviders: mocks.loadProviders,
  runAgentTurn: mocks.runTurn,
}));

beforeEach(() => {
  mocks.loadProviders.mockReset();
  mocks.runTurn.mockReset();
  mocks.configuration.mockReset();
  mocks.loadProviders.mockResolvedValue([
    {
      providerCode: 'deepseek',
      providerName: 'DeepSeek',
      modelAliases: ['default'],
    },
  ]);
  HTMLElement.prototype.scrollTo = vi.fn();
});

async function submit(wrapper: ReturnType<typeof mount>, content: string) {
  await wrapper.find('textarea').setValue(content);
  await wrapper.find('form').trigger('submit');
  await flushPromises();
}

const settings = defineComponent({
  emits: ['saved', 'close'],
  setup(_props, { emit }) {
    return () => h('button', { onClick: () => emit('saved') }, '保存模型');
  },
});

describe('网页AI助手状态', () => {
  it('打开配置窗口并在保存后刷新模型目录', async () => {
    mocks.configuration.mockReturnValue(settings);
    const wrapper = mount(AgentPanel, {
      props: { accessToken: 'token-a', userId: 'user-a' },
    });
    await flushPromises();
    await wrapper.get('.agent-launcher').trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '模型配置')
      ?.trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存模型')
      ?.trigger('click');
    await flushPromises();
    expect(mocks.loadProviders).toHaveBeenCalledTimes(2);
  });
  it('刷新后已选供应商失效时不自动切换到其他供应商', async () => {
    mocks.configuration.mockReturnValue(settings);
    mocks.loadProviders
      .mockResolvedValueOnce([
        {
          providerCode: 'openai',
          providerName: 'OpenAI',
          modelAliases: ['default'],
        },
      ])
      .mockResolvedValueOnce([
        {
          providerCode: 'deepseek',
          providerName: 'DeepSeek',
          modelAliases: ['default'],
        },
      ]);
    const wrapper = mount(AgentPanel, {
      props: { accessToken: 'token-a', userId: 'user-a' },
    });
    await flushPromises();
    await wrapper.get('.agent-launcher').trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '模型配置')
      ?.trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存模型')
      ?.trigger('click');
    await flushPromises();
    expect(
      (
        wrapper.get('select[aria-label="选择模型接入"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe('openai');
    expect(wrapper.text()).toContain('所选模型在当前范围不可用');
    await wrapper.get('textarea').setValue('你好');
    expect(
      wrapper.get('button[type="submit"]').attributes('disabled'),
    ).toBeDefined();
  });
  it('流式内容在完成前展示，结束后只保留最终消息', async () => {
    let finish!: (value: unknown) => void;
    mocks.runTurn.mockImplementation(
      (
        _history,
        _path,
        _admin,
        _provider,
        _progress,
        _signal,
        _trace,
        onText,
      ) => {
        onText('正在回答');
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    );
    const wrapper = mount(AgentPanel, {
      props: { accessToken: 'token-a', userId: 'user-a' },
    });
    await flushPromises();
    await wrapper.find('.agent-launcher').trigger('click');
    await wrapper.find('textarea').setValue('你好');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('正在回答');
    finish({ message: { role: 'Assistant', content: '完整回答' } });
    await flushPromises();
    expect(wrapper.text()).not.toContain('正在回答');
    expect(wrapper.text()).toContain('完整回答');
  });
  it('无可用网页模型时提示配置入口并保留未发送草稿', async () => {
    mocks.loadProviders.mockResolvedValue([]);
    const wrapper = mount(AgentPanel, {
      props: { accessToken: 'token-a', userId: 'user-a' },
    });
    await flushPromises();
    await wrapper.find('.agent-launcher').trigger('click');
    await flushPromises();
    await submit(wrapper, '你好');
    expect(wrapper.text()).toContain('AI 助手模型配置');
    expect(
      wrapper.find('button[type="submit"]').attributes('disabled'),
    ).toBeDefined();
    expect(
      (wrapper.find('textarea').element as HTMLTextAreaElement).value,
    ).toBe('你好');
    expect(mocks.runTurn).not.toHaveBeenCalled();
  });
  it('入口、标题、助手发言和无障碍标签统一为AI助手', async () => {
    mocks.runTurn.mockResolvedValue({
      message: { role: 'Assistant', content: '测试回复' },
    });
    const wrapper = mount(AgentPanel, {
      props: { accessToken: 'token-a', userId: 'user-a' },
    });
    await flushPromises();
    expect(wrapper.find('.agent-launcher').text()).toBe('AI助手');
    expect(wrapper.find('.agent-launcher').attributes('aria-label')).toBe(
      '展开AI助手',
    );
    await wrapper.find('.agent-launcher').trigger('click');
    expect(wrapper.find('section').attributes('aria-label')).toBe('AI助手');
    expect(wrapper.find('strong').text()).toBe('AI助手');
    await submit(wrapper, '你好');
    expect(wrapper.find('.from-agent .agent-speaker').text()).toBe('AI助手');
    expect(wrapper.text()).not.toContain('系统 AI');
  });
  it('写入结果不确定时保留复查状态且绝不重复提交', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('核验连接中断'));
    const recheck = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    mocks.runTurn.mockResolvedValue({
      message: { role: 'Assistant', content: '队列启停预览' },
      pendingWrite: {
        description: '队列启停',
        source: '队列接口',
        execute,
        recheck,
      },
    });
    const wrapper = mount(AgentPanel, {
      props: { accessToken: 'token-a', userId: 'user-a', scopeKey: 'scope-a' },
    });
    await flushPromises();
    await wrapper.find('.agent-launcher').trigger('click');
    await submit(wrapper, '停用队列 q1');
    await submit(wrapper, '确认');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('不会重复提交');

    await submit(wrapper, '确认');
    expect(execute).toHaveBeenCalledTimes(1);
    await submit(wrapper, '复查');
    expect(recheck).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('仍不确定');
    await submit(wrapper, '复查');
    expect(recheck).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('当前状态已达到目标');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('租户或域范围变化后清除旧供应商并自动选择新范围可用项', async () => {
    mocks.loadProviders
      .mockResolvedValueOnce([
        { providerCode: 'a', providerName: 'A', modelAliases: [] },
        { providerCode: 'b', providerName: 'B', modelAliases: [] },
      ])
      .mockResolvedValueOnce([
        { providerCode: 'c', providerName: 'C', modelAliases: [] },
      ]);
    const wrapper = mount(AgentPanel, {
      props: {
        accessToken: 'token-a',
        userId: 'user-a',
        scopeKey: 'tenant-1:domain-1',
      },
    });
    await flushPromises();
    await wrapper.find('.agent-launcher').trigger('click');
    const selector = wrapper.find('select');
    expect((selector.element as HTMLSelectElement).value).toBe('a');
    await selector.setValue('b');
    const previousSignal = mocks.loadProviders.mock
      .calls[0]?.[0] as AbortSignal;
    expect(previousSignal.aborted).toBe(false);
    await wrapper.setProps({ scopeKey: 'tenant-2:domain-2' });
    expect(previousSignal.aborted).toBe(true);
    await flushPromises();
    expect(mocks.loadProviders).toHaveBeenCalledTimes(2);
    await wrapper.find('.agent-launcher').trigger('click');
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe(
      'c',
    );
    expect(wrapper.text()).not.toContain('B');
  });

  it('同租户切换组织会废止旧组织的待确认写入', async () => {
    const execute = vi.fn();
    mocks.runTurn
      .mockResolvedValueOnce({
        message: { role: 'Assistant', content: '旧组织队列预览' },
        pendingWrite: {
          description: '旧组织队列',
          source: '队列接口',
          execute,
          recheck: vi.fn(),
        },
      })
      .mockResolvedValueOnce({
        message: { role: 'Assistant', content: '没有待确认操作' },
      });
    const wrapper = mount(AgentPanel, {
      props: {
        accessToken: 'token-a',
        userId: 'user-a',
        scopeKey: 'tenant-1:org-1:domain-1',
      },
    });
    await flushPromises();
    await wrapper.find('.agent-launcher').trigger('click');
    await submit(wrapper, '停用旧组织队列');
    expect(wrapper.text()).toContain('旧组织队列预览');

    await wrapper.setProps({ scopeKey: 'tenant-1:org-2:domain-1' });
    await flushPromises();
    expect(wrapper.find('.agent-launcher').exists()).toBe(true);
    await wrapper.find('.agent-launcher').trigger('click');
    expect(wrapper.text()).not.toContain('旧组织队列预览');
    await submit(wrapper, '确认');
    expect(execute).not.toHaveBeenCalled();
    expect(mocks.runTurn).toHaveBeenCalledTimes(2);
  });
  it('确认核验成功后继续原任务并保留执行记录', async () => {
    const resume = vi.fn(async (_result, _progress, _signal, onTrace) => {
      onTrace({
        id: 1,
        skill: 'customer.change',
        status: 'completed',
        source: '客户接口',
      });
      return { message: { role: 'Assistant', content: '继续分析完成' } };
    });
    mocks.runTurn.mockResolvedValueOnce({
      message: { role: 'Assistant', content: '客户修改预览' },
      continueAfterWrite: resume,
      pendingWrite: {
        description: '修改客户',
        source: '客户接口',
        execute: async () => '客户已核验',
        recheck: async () => true,
      },
    });
    const wrapper = mount(AgentPanel, {
      props: { accessToken: 'token', userId: 'u1' },
    });
    await flushPromises();
    await wrapper.find('.agent-launcher').trigger('click');
    await submit(wrapper, '把客户分组设为VIP并分析');
    await submit(wrapper, '确认');
    expect(resume).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('客户已核验');
    expect(wrapper.text()).toContain('继续分析完成');
    expect(wrapper.text()).toContain('客户接口');
    expect(wrapper.text()).toContain('已完成');
  });

  it('停止按钮取消在途模型请求并保留停止说明', async () => {
    mocks.runTurn.mockImplementationOnce(
      async (_history, _path, _super, _provider, _progress, signal) =>
        new Promise((resolve) => {
          signal.addEventListener(
            'abort',
            () =>
              resolve({
                message: { role: 'Assistant', content: '已停止后续处理。' },
              }),
            { once: true },
          );
        }),
    );
    const wrapper = mount(AgentPanel, {
      props: { accessToken: 'token', userId: 'u1' },
    });
    await flushPromises();
    await wrapper.find('.agent-launcher').trigger('click');
    await wrapper.find('textarea').setValue('分析');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    await wrapper.find('.agent-stop').trigger('click');
    await flushPromises();
    expect((mocks.runTurn.mock.calls[0]?.[5] as AbortSignal).aborted).toBe(
      true,
    );
    expect(wrapper.text()).toContain('已停止后续处理');
  });
});
