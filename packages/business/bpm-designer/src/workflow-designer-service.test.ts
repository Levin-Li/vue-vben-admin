import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTreeDefinition } from './definition-model';
import { WorkflowDesignerService } from './workflow-designer-service';
import { createTaskGraph } from './workflow-task-graph';

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

  it('按显式选择的租户请求授权能力目录', async () => {
    const service = new WorkflowDesignerService('/workflow-api');
    await service.listBusinessTypes('tenant-a');
    expect(requestCalls.get).toHaveBeenCalledWith(
      'workflow-runtime/business-types',
      { params: { tenantId: 'tenant-a' } },
    );
  });

  it('模拟历史、详情和删除始终携带固定版本与记录标识', async () => {
    const service = new WorkflowDesignerService('/workflow-api');
    await service.simulationRuns('v1', 2, 10);
    await service.simulationRun('v1', 'run-1');
    await service.deleteSimulationRun('v1', 'run-1');
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      1,
      'WorkflowDefinitionVersion/simulation-runs',
      { params: { versionId: 'v1', pageIndex: 2, pageSize: 10 } },
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      2,
      'WorkflowDefinitionVersion/simulation-run',
      { params: { versionId: 'v1', runId: 'run-1' } },
    );
    expect(requestCalls.post).toHaveBeenCalledWith(
      'WorkflowDefinitionVersion/delete-simulation-run',
      { data: { versionId: 'v1', runId: 'run-1' } },
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
    ).rejects.toThrow('不支持此流程设计格式。');
    expect(requestCalls.post).not.toHaveBeenCalled();
  });
});

// 任务图保持自己的协议与证明，不经过旧状态图或树投影。
describe('任务图版本连接器', () => {
  it('显式提交任务图且保留绑定，不转换成状态节点', async () => {
    const graph = createTaskGraph(
      {
        businessEntityKey: 'example.Order',
        stateField: 'status',
        stateType: 'string',
        stateMapping: [
          { value: 'Draft', label: '草稿' },
          { value: 'Done', label: '完成' },
        ],
      },
      'task_review',
      '任务审批',
    );
    await new WorkflowDesignerService().saveDraft('task-v1', graph, 2);
    expect(requestCalls.post).toHaveBeenLastCalledWith(
      'WorkflowDefinitionVersion/save-design',
      {
        data: { id: 'task-v1', optimisticLock: 2, lowflowDefinition: graph },
      },
    );
    expect(graph.nodes.map((node) => node.type)).toEqual(['start', 'end']);
    expect(graph.nodes.every((node) => !('stateValue' in node))).toBe(true);
  });
});
