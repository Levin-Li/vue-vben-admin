import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ loaded: 0, get: vi.fn() }));
vi.mock('../api/_module', () => ({ oakBaseGet: state.get }));
vi.mock('@levin/oak-base-admin/ai-sdk-browser', async (importOriginal) => {
  state.loaded += 1;
  return importOriginal();
});

it('基础入口、供应商目录和无效配置不加载模型SDK', async () => {
  const { oakBrowserAgentTransport } =
    await import('../api/ai-browser-agent-service');
  expect(state.loaded).toBe(0);
  state.get.mockResolvedValue([]);
  expect(await oakBrowserAgentTransport.listProviders()).toEqual([]);
  await expect(oakBrowserAgentTransport.chat([], 'deepseek')).rejects.toThrow(
    '未启用',
  );
  expect(state.loaded).toBe(0);
});
