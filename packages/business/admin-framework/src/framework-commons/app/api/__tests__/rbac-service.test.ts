import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestGet: vi.fn(),
}));

vi.mock('../request', () => ({
  baseRequestClient: {
    get: vi.fn(),
  },
  requestClient: {
    get: mocks.requestGet,
    post: vi.fn(),
  },
}));

import { RbacService } from '../rbac-service';

describe('RbacService user info', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves backend homePath for route fallback', async () => {
    mocks.requestGet.mockResolvedValueOnce({
      homePath: '/photo/workspace-4',
      id: 'u1',
      loginName: 'photo-user',
      roleList: ['photography'],
    });

    const service = new RbacService();

    await expect(service.getUserInfo()).resolves.toMatchObject({
      homePath: '/photo/workspace-4',
      roles: ['photography'],
      userId: 'u1',
      username: 'photo-user',
    });
  });

  it('falls back to root when backend homePath is blank', async () => {
    mocks.requestGet.mockResolvedValueOnce({
      homePath: '  ',
      id: 'u2',
      loginName: 'root-user',
    });

    const service = new RbacService();

    await expect(service.getUserInfo()).resolves.toMatchObject({
      homePath: '/',
      userId: 'u2',
      username: 'root-user',
    });
  });

  it('passes excluded root node types to permission tree API', async () => {
    mocks.requestGet.mockResolvedValueOnce([]);

    const service = new RbacService();

    await service.fetchAuthorizedPermissionTree({
      excludeRootNodeTypes: ['Menu'],
    });

    expect(mocks.requestGet).toHaveBeenCalledWith('/rbac/authorizedPermissionTree', {
      params: {
        excludeRootNodeTypes: ['Menu'],
      },
    });
  });
});
