import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { oakBrowserAgentTransport } from '../api/ai-browser-agent-service';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api/_module', () => ({ oakBaseGet: mocks.get }));
const config = {
  providerCode: 'deepseek',
  providerName: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com/v1/',
  apiKey: 'browser-test-key',
  defaultModelAlias: 'default',
  modelAliases: [{ alias: 'default', providerModelId: 'deepseek-flash' }],
  timeoutSeconds: 1,
};
const messages = [
  { role: 'System', content: '系统提示' },
  { role: 'User', content: '你好' },
];
// 使用真实 Chat Completions 协议夹具，SDK 不做替身，验证实际序列化与解析。
function completionResponse(content = '测试回复') {
  return Response.json({
    id: 'chat-test',
    object: 'chat.completion',
    created: 1_700_000_000,
    model: 'deepseek-flash',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
  });
}
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue([structuredClone(config)]);
  fetchMock = vi.fn().mockImplementation(async () => completionResponse());
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('网页 Agent 直连模型', () => {
  it('模型直接请求供应商并隔离业务身份和敏感配置事件', async () => {
    expect(await oakBrowserAgentTransport.chat(messages, 'deepseek')).toBe(
      '测试回复',
    );
    expect(mocks.get).toHaveBeenCalledWith('/client/ai/chat/browser-config', {
      signal: undefined,
      __silentError: true,
      __sensitiveResponse: true,
    });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(request).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
      mode: 'cors',
      referrerPolicy: 'no-referrer',
    });
    expect(request.headers).toEqual({
      Authorization: 'Bearer browser-test-key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(request.body)).toEqual({
      model: 'deepseek-flash',
      messages: [
        { role: 'system', content: '系统提示' },
        { role: 'user', content: '你好' },
      ],
      stream: false,
      max_tokens: 4096,
      reasoning_effort: 'none',
    });
    expect(request.body).not.toContain(config.apiKey);
  });
  it('目录不含凭证且逐次读取配置并排除 Claude Code', async () => {
    mocks.get.mockResolvedValue([
      config,
      { ...config, providerCode: 'claude-code' },
    ]);
    expect(await oakBrowserAgentTransport.listProviders()).toEqual([
      {
        providerCode: 'deepseek',
        providerName: 'DeepSeek',
        modelAliases: ['default'],
      },
    ]);
    await oakBrowserAgentTransport.chat(messages, 'deepseek');
    expect(mocks.get).toHaveBeenCalledTimes(2);
    await expect(
      oakBrowserAgentTransport.chat(messages, 'claude-code'),
    ).rejects.toThrow('未启用');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(['openai', 'glm', 'kimi', 'minimax'])(
    '兼容 %s 模型协议',
    async (providerCode) => {
      mocks.get.mockResolvedValue([{ ...config, providerCode }]);
      await oakBrowserAgentTransport.chat(messages, providerCode);
      expect(
        JSON.parse(fetchMock.mock.calls[0]?.[1].body || '{}'),
      ).toMatchObject({
        max_completion_tokens: 4096,
      });
    },
  );
  it.each([
    'http://api.example.com',
    'https://user:pass@api.example.com',
    'https://api.example.com?token=secret',
    'https://api.example.com#secret',
    'https://api.example.com:8443',
  ])('拒绝危险端点 %s 且无后端兜底', async (baseUrl) => {
    mocks.get.mockResolvedValue([{ ...config, baseUrl }]);
    await expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow('网页模型请求失败');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
  it('供应商 HTTP、网络和解析错误不显示供应商内容或凭证', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(config.apiKey, { status: 401 }),
    );
    await expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow(/^网页模型请求失败/);
    fetchMock.mockRejectedValueOnce(new Error(config.apiKey));
    await expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow(/^网页模型请求失败/);
    fetchMock.mockResolvedValueOnce(new Response(config.apiKey));
    await expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow(/^网页模型请求失败/);
  });
  it('超时和范围失效均取消供应商请求', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        ),
    );
    const timeoutCall = expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow('超时');
    await vi.advanceTimersByTimeAsync(1001);
    await timeoutCall;
    const controller = new AbortController();
    const cancelCall = expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek', controller.signal),
    ).rejects.toThrow('会话已失效');
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await cancelCall;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      mocks.get.mock.calls.every(([path]) => path.endsWith('/browser-config')),
    ).toBe(true);
  });
  it('配置读取期间范围失效不会发送旧凭证', async () => {
    const controller = new AbortController();
    mocks.get.mockImplementation(async () => {
      controller.abort();
      return [config];
    });
    await expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek', controller.signal),
    ).rejects.toThrow('会话已失效');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('限制请求与解压后的回复字节', async () => {
    await expect(
      oakBrowserAgentTransport.chat(
        [{ role: 'User', content: '中'.repeat(50_000) }],
        'deepseek',
      ),
    ).rejects.toThrow('网页模型请求失败');
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(new Response('中'.repeat(50_000)));
    await expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow('网页模型请求失败');
  });
  it.each([401, 429, 500])(
    'hTTP %s 失败只调用一次，不自动重试或回退',
    async (status) => {
      fetchMock.mockResolvedValue(new Response(config.apiKey, { status }));
      await expect(
        oakBrowserAgentTransport.chat(messages, 'deepseek'),
      ).rejects.toThrow('网页模型请求失败');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(mocks.get).toHaveBeenCalledTimes(1);
    },
  );
  it('模型回显凭证会脱敏，SDK 不输出原始警告或响应日志', async () => {
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const logging = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const emitting = vi
      .spyOn(process, 'emitWarning')
      .mockImplementation(() => undefined);
    try {
      fetchMock.mockResolvedValue(completionResponse(`回复 ${config.apiKey}`));
      await expect(
        oakBrowserAgentTransport.chat(messages, 'deepseek'),
      ).resolves.toBe('回复 [凭证已隐藏]');
      expect(warning).not.toHaveBeenCalled();
      expect(logging).not.toHaveBeenCalled();
      expect(emitting).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
      logging.mockRestore();
      emitting.mockRestore();
    }
  });
  it.each([
    { choices: 'invalid' },
    { choices: [] },
    { choices: [{ message: { content: 123 } }] },
  ])('由实际 SDK 拒绝畸形响应 %j', async (payload) => {
    fetchMock.mockResolvedValue(Response.json(payload));
    await expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow('网页模型请求失败');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('拒绝空回复和重定向响应，不向其它地址发出请求', async () => {
    fetchMock.mockResolvedValueOnce(completionResponse(' '));
    await expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow('网页模型请求失败');
    const redirected = completionResponse();
    Object.defineProperty(redirected, 'redirected', { value: true });
    fetchMock.mockResolvedValueOnce(redirected);
    await expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow('网页模型请求失败');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.every(
        ([url]) => url === 'https://api.deepseek.com/v1/chat/completions',
      ),
    ).toBe(true);
  });
  it('响应声明过大时取消读取，禁止继续由 SDK 解析', async () => {
    const cancelled = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ cancel: cancelled }), {
        headers: { 'Content-Length': '128001' },
      }),
    );
    await expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow('网页模型请求失败');
    expect(cancelled).toHaveBeenCalledOnce();
  });
  it('响应头已到达但正文停滞时仍然超时并取消流读取', async () => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ cancel: cancelled })),
    );
    const call = expect(
      oakBrowserAgentTransport.chat(messages, 'deepseek'),
    ).rejects.toThrow('超时');
    await vi.advanceTimersByTimeAsync(1001);
    await call;
    expect(cancelled).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
