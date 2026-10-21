import type { AgentModelTransport } from '@levin/admin-framework';

import { oakBaseGet } from './_module';

interface BrowserProviderConfig {
  apiKey: string;
  baseUrl: string;
  defaultModelAlias: string;
  modelAliases: Array<{ alias: string; providerModelId: string }>;
  providerCode: string;
  providerName: string;
  timeoutSeconds: number;
}

const PROVIDERS = new Set(['deepseek', 'glm', 'kimi', 'minimax', 'openai']);
const MAX_REQUEST_BYTES = 128_000;
const MAX_RESPONSE_BYTES = 128_000;

// 动态模块下载本身不可取消；等待须受会话取消和总超时约束，迟到的模块不得继续请求。
async function loadBrowserRuntime(signal: AbortSignal) {
  signal.throwIfAborted();
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([
      import('@levin/oak-base-admin/ai-sdk-browser'),
      aborted,
    ]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}

// 配置只在当前调用栈内使用；不写入状态、存储、日志或模型消息。
// 对应后端 com.levin.oak.base.ai.web.AiBrowserConfigController。
async function loadConfigs(signal?: AbortSignal) {
  signal?.throwIfAborted();
  try {
    const configs = await oakBaseGet<BrowserProviderConfig[]>(
      '/client/ai/chat/browser-config',
      { signal, __silentError: true, __sensitiveResponse: true },
    );
    signal?.throwIfAborted();
    if (!Array.isArray(configs)) throw new Error('网页模型响应无效');
    return configs.filter((config) => PROVIDERS.has(config?.providerCode));
  } catch {
    throw new Error(
      signal?.aborted ? '当前会话已失效' : '网页模型配置读取失败',
    );
  }
}

// HTTPS 原生请求独立于业务 requestClient，禁止携带系统会话或跟随重定向。
function completionUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (
    url.protocol !== 'https:' ||
    (url.port && url.port !== '443') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (typeof location !== 'undefined' && url.origin === location.origin)
  )
    throw new Error('网页模型端点配置无效');
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/chat/completions`;
  return url.href;
}

async function readResponse(response: Response, signal: AbortSignal) {
  const length = Number(response.headers.get('content-length'));
  if (length > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('模型回复超过大小限制');
  }
  if (!response.body) throw new Error('模型未返回有效回复');
  const reader = response.body.getReader();
  // 中断时主动取消流读取，响应头已到达后仍受同一个超时和会话边界控制。
  const cancelRead = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancelRead, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error('模型回复超过大小限制');
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    signal.throwIfAborted();
    return new Response(bytes, {
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    signal.removeEventListener('abort', cancelRead);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export const oakBrowserAgentTransport: AgentModelTransport = {
  async listProviders(signal) {
    const configs = await loadConfigs(signal);
    return configs.map(({ providerCode, providerName, modelAliases }) => ({
      providerCode,
      providerName,
      modelAliases: modelAliases.map(({ alias }) => alias),
    }));
  },
  async chat(messages, providerCode, signal) {
    const configs = await loadConfigs(signal);
    // “系统默认”只在当前授权目录中选择首项，显式失效的供应商不能自动替换。
    const config = providerCode
      ? configs.find((item) => item.providerCode === providerCode)
      : configs[0];
    if (!config) {
      throw new Error(
        configs.length === 0
          ? '当前租户或域名没有可用的网页模型，请管理员在服务插件设置管理中启用 AI 插件并配置网页直连'
          : '所选网页模型在当前范围未启用，请刷新模型列表后重试',
      );
    }
    const model = config.modelAliases.find(
      ({ alias }) => alias === config.defaultModelAlias,
    )?.providerModelId;
    if (!model || !config.apiKey || /[\r\n]/.test(config.apiKey)) {
      throw new Error('网页模型配置不完整');
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const seconds = Math.max(1, Math.min(180, config.timeoutSeconds || 60));
    const timeout = setTimeout(onAbort, seconds * 1000);
    try {
      signal?.throwIfAborted();
      const url = completionUrl(config.baseUrl);
      // 仅在合法模型调用时加载包内浏览器产物，目录读取和模块初始化不加载 SDK。
      const { createOpenAICompatible, generateText, wrapLanguageModel } =
        await loadBrowserRuntime(controller.signal);
      controller.signal.throwIfAborted();
      // 模型与供应商均显式指定，SDK 只负责协议生成和解析，不启用 Gateway。
      const provider = createOpenAICompatible({
        name: config.providerCode,
        baseURL: url.slice(0, -'/chat/completions'.length),
        apiKey: config.apiKey,
        transformRequestBody: (body) => {
          // 供应商只允许使用既有输出上限参数，不接受模型指定任意请求扩展。
          const { max_tokens: maxTokens, ...rest } = body;
          return {
            ...rest,
            stream: false,
            ...(config.providerCode === 'deepseek'
              ? { max_tokens: maxTokens, reasoning_effort: 'none' }
              : { max_completion_tokens: maxTokens }),
          };
        },
        fetch: async (input, init) => {
          // 即使 SDK 改变调用方式，也只能访问本次配置的唯一端点和 POST 方法。
          if (String(input) !== url || init?.method !== 'POST') {
            throw new Error('网页模型端点不匹配');
          }
          const body = init.body;
          if (
            typeof body !== 'string' ||
            new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES
          ) {
            throw new Error('请求超过大小限制');
          }
          controller.signal.throwIfAborted();
          const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body,
            signal: controller.signal,
          });
          if (!response.ok || response.redirected) {
            await response.body?.cancel().catch(() => undefined);
            throw new Error('网页模型响应无效');
          }
          // 先限制浏览器解压后的响应字节，再交给 SDK 的协议 Schema 解析。
          return readResponse(response, controller.signal);
        },
      });

      // 局部屏蔽供应商警告正文，避免 SDK 默认日志泄露敏感配置，不改全局日志器。
      const languageModel = wrapLanguageModel({
        model: provider.chatModel(model),
        middleware: {
          specificationVersion: 'v3',
          wrapGenerate: async ({ doGenerate }) => ({
            ...(await doGenerate()),
            warnings: [],
          }),
        },
      });
      const result = await generateText({
        model: languageModel,
        messages: messages.map(({ content, role }) => {
          // 角色只能来自平台会话类型；保留可信系统消息在循环中的原始顺序。
          const normalizedRole = role.toLowerCase();
          if (
            normalizedRole !== 'assistant' &&
            normalizedRole !== 'system' &&
            normalizedRole !== 'user'
          ) {
            throw new Error('消息角色无效');
          }
          return { content, role: normalizedRole };
        }),
        allowSystemInMessages: true,
        maxOutputTokens: 4096,
        maxRetries: 0,
        abortSignal: controller.signal,
        experimental_telemetry: {
          isEnabled: false,
          recordInputs: false,
          recordOutputs: false,
        },
      });
      controller.signal.throwIfAborted();
      const answer = result.text;
      if (!answer.trim()) throw new Error('网页模型响应无效');
      return answer.replaceAll(config.apiKey, '[凭证已隐藏]');
    } catch {
      if (signal?.aborted) throw new Error('当前会话已失效');
      if (controller.signal.aborted) throw new Error('网页模型请求超时');
      throw new Error('网页模型请求失败，请检查浏览器跨域许可、端点和凭证配置');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    }
  },
};
