import { expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('../api/_module', () => ({ oakBaseGet: get }));
vi.mock('@levin/oak-base-admin/ai-sdk-browser', () => {
  throw new Error('测试运行时不可用的内部详情');
});

it('运行时加载失败仅影响当前模型调用且不泄露内部详情', async () => {
  const { oakBrowserAgentTransport } =
    await import('../api/ai-browser-agent-service');
  get.mockResolvedValue([
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
  await expect(oakBrowserAgentTransport.chat([], 'deepseek')).rejects.toThrow(
    /^网页模型请求失败，请检查浏览器跨域许可、端点和凭证配置$/,
  );
  expect(await oakBrowserAgentTransport.listProviders()).toHaveLength(1);
});
