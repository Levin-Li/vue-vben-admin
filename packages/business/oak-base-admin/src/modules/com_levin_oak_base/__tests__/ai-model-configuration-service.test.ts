import { beforeEach, expect, it, vi } from 'vitest';

import { aiModelConfigurationService } from '../api/ai-model-configuration-service';

const post = vi.hoisted(() => vi.fn());
vi.mock('../api/_module', () => ({ oakBasePost: post }));

beforeEach(() => post.mockReset());
it('配置维护和读取都使用受保护的业务方法', async () => {
  post.mockResolvedValueOnce({ scopes: ['personal'] });
  expect(await aiModelConfigurationService.scopes()).toEqual(['personal']);
  expect(post).toHaveBeenCalledWith(
    '/AiModelSetting/modelConfig',
    { operation: 'metadata' },
    expect.objectContaining({ __sensitiveResponse: true }),
  );
  post.mockResolvedValueOnce({ settings: [] });
  expect(await aiModelConfigurationService.list('personal')).toEqual([]);
  expect(post).toHaveBeenLastCalledWith(
    '/AiModelSetting/modelConfig',
    { operation: 'list', scope: 'personal' },
    expect.any(Object),
  );
});
