import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserMessageService } from '../api/user-message-service';

const calls = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  emit: vi.fn(),
}));
vi.mock('@levin/admin-framework', () => ({
  ResAuthorize: () => () => {},
  Service: () => () => {},
  requestClient: {},
  emitFrameworkEvent: calls.emit,
  RequestService: class {
    get = calls.get;
    post = calls.post;
  },
}));

describe('个人消息 API 合约', () => {
  beforeEach(() => vi.clearAllMocks());

  it('铃铛与消息页采用同一个已读请求体，成功后刷新服务端未读数', async () => {
    const service = new UserMessageService();
    await service.markRead({ ids: ['message-1'] });
    expect(calls.post).toHaveBeenCalledWith('markRead', {
      data: { ids: ['message-1'] },
    });
    expect(calls.emit).toHaveBeenCalledWith(
      'personal-message',
      'read.changed',
      {},
    );
  });

  it('整批已读失败时不发成功变更通知', async () => {
    calls.post.mockRejectedValueOnce(new Error('无权访问'));
    await expect(
      new UserMessageService().markRead({ ids: ['message-2'] }),
    ).rejects.toThrow('无权访问');
    expect(calls.emit).not.toHaveBeenCalled();
  });
});
