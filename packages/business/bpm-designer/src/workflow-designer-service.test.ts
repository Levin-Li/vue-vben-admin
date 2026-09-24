import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestCalls = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    constructor(readonly basePath: string) {}

    get = requestCalls.get;

    post = requestCalls.post;
  },
}));

import { WorkflowDesignerService } from './workflow-designer-service';

describe('WorkflowDesignerService', () => {
  beforeEach(() => {
    requestCalls.get.mockReset();
    requestCalls.post.mockReset();
    requestCalls.post.mockResolvedValue({ id: 'version-1' });
  });

  it('uses the workflow-definition API contract for draft, simulation, and publish', async () => {
    // 设计期请求只提交服务端版本标识与 lowflow 定义，最终生命周期裁决始终留在后端。
    const service = new WorkflowDesignerService('/workflow-api');

    await service.saveDraft('version-1', '{"nodes":[]}');
    await service.startSimulation('version-1');
    await service.publishAfterSimulation('version-1');

    expect(requestCalls.post).toHaveBeenNthCalledWith(1, 'workflowdefinitionversion/update', {
      data: { id: 'version-1', lowflowJson: '{"nodes":[]}' },
    });
    expect(requestCalls.post).toHaveBeenNthCalledWith(2, 'workflowdefinitionversion/start-simulation', {
      data: { id: 'version-1' },
    });
    expect(requestCalls.post).toHaveBeenNthCalledWith(3, 'workflowdefinitionversion/publish-after-simulation', {
      data: { id: 'version-1' },
    });
  });
});
