import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ started: false, get: vi.fn() }));
vi.mock('../api/_module', () => ({ oakBaseGet: state.get }));
vi.mock('@levin/oak-base-admin/ai-sdk-browser', () => {
  state.started = true;
  // 模拟浏览器模块下载悬挂，不能等待这个 Promise 才响应停止或超时。
  return new Promise(() => {});
});

beforeEach(() => {
  // 每个场景重新触发悬挂的模块下载，避免复用上一场景的加载状态。
  vi.resetModules();
  state.started = false;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(['停止', '超时'])(
  '运行时下载中%s及时结束且不发模型请求',
  async (mode) => {
    vi.useFakeTimers();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    state.get.mockResolvedValue([
      {
        apiKey: 'test-browser-key',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModelAlias: 'default',
        modelAliases: [{ alias: 'default', providerModelId: 'test-model' }],
        providerCode: 'deepseek',
        providerName: 'DeepSeek',
        timeoutSeconds: 1,
      },
    ]);
    const { oakBrowserAgentTransport } =
      await import('../api/ai-browser-agent-service');
    const controller = new AbortController();
    const result = oakBrowserAgentTransport
      .chat([], 'deepseek', controller.signal)
      .then(
        () => null,
        (error: Error) => error.message,
      );
    await vi.waitFor(() => expect(state.started).toBe(true));
    if (mode === '停止') controller.abort();
    else await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toBe(
      mode === '停止' ? '当前会话已失效' : '网页模型请求超时',
    );
    expect(fetch).not.toHaveBeenCalled();
  },
);
