import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTreeDefinition } from './definition-model';
import { WorkflowDesignerService } from './workflow-designer-service';

const requestCalls = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    get = requestCalls.get;

    post = requestCalls.post;

    constructor(readonly basePath: string) {}
  },
}));

describe('workflowDesignerService', () => {
  beforeEach(() => {
    requestCalls.get.mockReset();
    requestCalls.post.mockReset();
    requestCalls.post.mockResolvedValue({ id: 'version-1' });
  });

  it('uses the workflow-definition API contract for draft, simulation, and publish', async () => {
    // 设计期请求只提交服务端版本标识与 lowflow 定义，最终生命周期裁决始终留在后端。
    const service = new WorkflowDesignerService('/workflow-api');

    const definition = createTreeDefinition('review', '审核');
    await service.saveDraft('version-1', definition, 3);
    await service.startSimulation('version-1');
    await service.publishAfterSimulation('version-1');

    expect(requestCalls.post).toHaveBeenNthCalledWith(
      1,
      'WorkflowDefinitionVersion/save-design',
      {
        data: {
          id: 'version-1',
          optimisticLock: 3,
          lowflowDefinition: definition,
        },
      },
    );
    expect(requestCalls.post).toHaveBeenNthCalledWith(
      2,
      'WorkflowDefinitionVersion/start-simulation',
      {
        data: { id: 'version-1' },
      },
    );
    expect(requestCalls.post).toHaveBeenNthCalledWith(
      3,
      'WorkflowDefinitionVersion/publish-after-simulation',
      {
        data: { id: 'version-1' },
      },
    );
  });

  it('通过独立目录接口读取业务能力', async () => {
    const service = new WorkflowDesignerService('/workflow-api');
    await service.listBusinessTypes();
    expect(requestCalls.get).toHaveBeenCalledWith(
      'workflow-runtime/business-types',
    );
  });

  it('拒绝将旧 v2 平面图发送到保存接口', async () => {
    const service = new WorkflowDesignerService('/workflow-api');
    await expect(
      service.saveDraft('version-1', {
        schemaVersion: 2,
        nodes: [],
        edges: [],
      } as never),
    ).rejects.toThrow('只接受 schemaVersion=3');
    expect(requestCalls.post).not.toHaveBeenCalled();
  });
});
