import type { AgentSkill } from '@levin/admin-framework';

import { agentExactKeys, agentId, agentLimit } from '@levin/admin-framework';

import {
  agentBusinessScope,
  agentPermission,
  agentReadSkills,
  projectAgentRecord,
} from './agent-business-common';
import { workflowDefinitionService } from './api/workflow-definition-service';
import { workflowExpenseService } from './api/workflow-expense-service';
import { workflowManagementService } from './api/workflow-management-service';
import { workflowRequestService } from './api/workflow-request-service';
import { workflowRuntimeService } from './api/workflow-runtime-service';

// 流程证据只保留定位与状态，不向模型提供表单、业务字段、意见、异常或轨迹正文。
const workflowFields = [
  'taskId',
  'taskName',
  'taskDefinitionKey',
  'processInstanceId',
  'instanceId',
  'businessId',
  'businessType',
  'tenantId',
  'orgId',
  'status',
  'outcome',
  'executionStatus',
  'effectStatus',
  'attemptNo',
  'definitionId',
  'definitionName',
  'definitionVersionId',
  'runId',
  'roundId',
  'purposeKey',
];

function optionalText(value: unknown, name: string, maximum: number) {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maximum ||
    [...value].some((character) => (character.codePointAt(0) ?? 0) < 32)
  ) {
    throw new Error(`${name} 格式不正确`);
  }
  return value;
}

// 游标由服务端签发，原样传回但限制长度；不允许模型注入用户身份、任意分页或查询列。
function cursorQuery(args: Record<string, unknown>) {
  return {
    size: agentLimit(args.size, 20),
    cursor: optionalText(args.cursor, '分页游标', 2048),
  };
}

function cursorResult(
  response: { hasMore?: boolean; items?: unknown[]; nextCursor?: string },
  size: number,
  source: string,
) {
  if (
    !response ||
    !Array.isArray(response.items) ||
    typeof response.hasMore !== 'boolean'
  ) {
    throw new Error('流程分页接口返回格式不正确');
  }
  const nextCursor = optionalText(
    response.nextCursor ?? undefined,
    '后续游标',
    2048,
  );
  if (response.hasMore && !nextCursor) throw new Error('流程分页缺少后续游标');
  const items = response.items
    .slice(0, size)
    .map((item) => projectAgentRecord(item, workflowFields));
  return {
    count: items.length,
    data: {
      items,
      hasMore: response?.hasMore === true,
      nextCursor,
    },
    source,
  };
}

function runtimeList(
  method: 'copied' | 'done' | 'started' | 'todo',
  title: string,
  invoke: (query: { cursor?: string; size: number }) => Promise<any>,
): AgentSkill {
  return {
    id: `com.levin.oak.base.workflowRuntime.${method}`,
    description: `${title}，只读当前登录用户有权访问的流程状态；可选 size（最多20）、cursor（服务端分页游标）。`,
    inputSchema: {
      required: [],
      properties: {
        size: { type: 'integer', maximum: 20 },
        cursor: { type: 'string', maxLength: 2048 },
      },
    },
    maxRecords: 20,
    permission: title,
    available: () => agentPermission(workflowRuntimeService, method),
    risk: 'read',
    execute: async (args) => {
      if (!agentPermission(workflowRuntimeService, method))
        throw new Error('当前用户无流程查询权限');
      agentExactKeys(args, ['size', 'cursor']);
      const query = cursorQuery(args);
      return cursorResult(await invoke(query), query.size, `${title}接口`);
    },
  };
}

function runtimeDetail(
  method: 'instance' | 'task',
  key: 'instanceId' | 'taskId',
  title: string,
  invoke: (id: string) => Promise<unknown>,
): AgentSkill {
  return {
    id: `com.levin.oak.base.workflowRuntime.${method}`,
    description: `${title}，仅接受 ${key}；服务端按当前登录主体重新授权。`,
    inputSchema: {
      required: [key],
      properties: { [key]: { type: 'string', maxLength: 128 } },
    },
    maxRecords: 1,
    permission: title,
    available: () => agentPermission(workflowRuntimeService, method),
    risk: 'read',
    execute: async (args) => {
      if (!agentPermission(workflowRuntimeService, method))
        throw new Error('当前用户无流程详情权限');
      agentExactKeys(args, [key]);
      const item = await invoke(agentId(args[key], key));
      return {
        count: item ? 1 : 0,
        data: item ? projectAgentRecord(item, workflowFields) : null,
        source: `${title}接口`,
      };
    },
  };
}

// 所有技能使用真实服务实例和固定方法，管理实例与个人工作台权限保持分离。
export const workflowAgentSkills: readonly AgentSkill[] = [
  ...agentReadSkills({
    resource: 'workflowRequest',
    title: '流程业务申请',
    service: workflowRequestService,
    fields: ['id', 'category', 'amount', 'documentsComplete', 'optimisticLock'],
  }),
  ...agentReadSkills({
    resource: 'workflowDefinition',
    title: '工作流定义',
    service: workflowDefinitionService,
    actions: ['list'],
    scope: false,
    fields: ['id', 'name', 'processKey', 'businessType'],
    filters: {
      businessType: { kind: 'code' },
      containsName: { kind: 'text', maxLength: 100 },
    },
  }),
  ...agentReadSkills({
    resource: 'workflowExpense',
    title: '流程报销核对',
    service: workflowExpenseService,
    actions: ['retrieve'],
    fields: ['id', 'claimedAmount', 'verifiedAmount', 'receiptsReady'],
  }),
  runtimeList('todo', '查询我的工作流待办', (query) =>
    workflowRuntimeService.todo(query),
  ),
  runtimeList('done', '查询我的工作流已办', (query) =>
    workflowRuntimeService.done(query),
  ),
  runtimeList('started', '查询我发起的工作流', (query) =>
    workflowRuntimeService.started(query),
  ),
  runtimeList('copied', '查询我收到的流程抄送', (query) =>
    workflowRuntimeService.copied(query),
  ),
  runtimeDetail('task', 'taskId', '查看我的工作流任务', (id) =>
    workflowRuntimeService.task(id),
  ),
  runtimeDetail('instance', 'instanceId', '查看我的工作流实例', (id) =>
    workflowRuntimeService.instance(id),
  ),
  {
    id: 'com.levin.oak.base.workflowManagement.instances',
    description:
      '按独立管理权限查询运行实例状态。可选 tenantId、orgId、definitionId、status、keyword、size、cursor；最多20条，不查询或推测总数。',
    inputSchema: {
      required: [],
      properties: {
        tenantId: { type: 'string', maxLength: 128 },
        orgId: { type: 'string', maxLength: 128 },
        definitionId: { type: 'string', maxLength: 64 },
        status: { type: 'string', maxLength: 32 },
        keyword: { type: 'string', maxLength: 100 },
        size: { type: 'integer', maximum: 20 },
        cursor: { type: 'string', maxLength: 2048 },
      },
    },
    maxRecords: 20,
    permission: '查询运行实例',
    available: () => agentPermission(workflowManagementService, 'instances'),
    risk: 'read',
    execute: async (args) => {
      if (!agentPermission(workflowManagementService, 'instances'))
        throw new Error('当前用户无实例管理权限');
      agentExactKeys(args, [
        'tenantId',
        'orgId',
        'definitionId',
        'status',
        'keyword',
        'size',
        'cursor',
      ]);
      if (
        args.status !== undefined &&
        !['Completed', 'PendingEffects', 'Running', 'Suspended'].includes(
          String(args.status),
        )
      )
        throw new Error('执行状态不正确');
      const query = cursorQuery(args);
      const response = await workflowManagementService.instances({
        ...query,
        ...agentBusinessScope(args),
        definitionId: optionalText(args.definitionId, '流程定义 ID', 64),
        status: args.status as string | undefined,
        keyword: optionalText(args.keyword, '关键词', 100),
      });
      return cursorResult(response, query.size, '运行实例管理查询接口');
    },
  },
  {
    id: 'com.levin.oak.base.workflowManagement.instance',
    description:
      '按独立管理权限查看一条运行实例状态；参数 instanceId，可选 tenantId、orgId。',
    inputSchema: {
      required: ['instanceId'],
      properties: {
        instanceId: { type: 'string', maxLength: 128 },
        tenantId: { type: 'string', maxLength: 128 },
        orgId: { type: 'string', maxLength: 128 },
      },
    },
    maxRecords: 1,
    permission: '查看运行实例',
    available: () => agentPermission(workflowManagementService, 'instance'),
    risk: 'read',
    execute: async (args) => {
      if (!agentPermission(workflowManagementService, 'instance'))
        throw new Error('当前用户无实例管理权限');
      agentExactKeys(args, ['instanceId', 'tenantId', 'orgId']);
      const item = await workflowManagementService.instance({
        instanceId: agentId(args.instanceId, '实例 ID'),
        ...agentBusinessScope(args),
      });
      return {
        count: item ? 1 : 0,
        data: item ? projectAgentRecord(item, workflowFields) : null,
        source: '运行实例管理详情接口',
      };
    },
  },
];
