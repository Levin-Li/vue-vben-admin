import type { AgentSkill } from '@levin/admin-framework';

import {
  agentExactKeys,
  agentId,
  agentLimit,
  currentGlobalOrgId,
  currentGlobalTenantId,
} from '@levin/admin-framework';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { oakBaseGet } from './api/_module';
import { ticketQueueService } from './api/ticket-queue-service';
import { ticketService } from './api/ticket-service';

function hasQueuePermission(method: 'list' | 'retrieve' | 'setEnabled') {
  const required = buildApiMethodPermissions(ticketQueueService, method);
  return required.length > 0 && useRbacAccess().hasPermission(required);
}

function hasTicketPermission(method: 'list' | 'retrieve') {
  const required = buildApiMethodPermissions(ticketService, method);
  return required.length > 0 && useRbacAccess().hasPermission(required);
}

function optionalAgentId(value: unknown, name: string) {
  return value === undefined ? undefined : agentId(value, name);
}

function safeTicketStatus(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[A-Z][\w-]{0,31}$/i.test(value)) {
    throw new Error('工单状态格式不正确');
  }
  return value;
}

interface DiagnosticEntry {
  applicationFrame?: string;
  causeType?: string;
  exceptionType?: string;
  fingerprint?: string;
  id?: string;
  method?: string;
  path?: string;
  status?: number;
  time?: string;
  traceFingerprint?: string;
}

function diagnosticTime(value: unknown, name: string): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(value)
  ) {
    throw new Error(`${name} 必须为 YYYY-MM-DDTHH:mm:ss`);
  }
  if (Number.isNaN(Date.parse(value))) throw new Error(`${name} 不是有效时间`);
  return value;
}

function diagnosticWindow(args: Record<string, unknown>) {
  const from = diagnosticTime(args.from, '开始时间');
  const to = diagnosticTime(args.to, '结束时间');
  const span = Date.parse(to) - Date.parse(from);
  if (span <= 0 || span > 24 * 60 * 60 * 1000) {
    throw new Error('诊断时间范围必须大于 0 且不超过 24 小时');
  }
  return { from, to, limit: agentLimit(args.limit, 50) };
}

// 相同异常指纹先在浏览器归并，减少模型上下文并明确重复次数；原始日志正文始终不可见。
function groupDiagnosticEvidence(items: DiagnosticEntry[]) {
  const groups = new Map<
    string,
    {
      count: number;
      firstSeen?: string;
      lastSeen?: string;
      sample: DiagnosticEntry;
    }
  >();

  for (const item of items) {
    const key =
      item.fingerprint ||
      item.id ||
      `${item.exceptionType}:${item.applicationFrame}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        count: 1,
        firstSeen: item.time,
        lastSeen: item.time,
        sample: item,
      });
      continue;
    }

    existing.count += 1;
    if (item.time && (!existing.firstSeen || item.time < existing.firstSeen)) {
      existing.firstSeen = item.time;
    }
    if (item.time && (!existing.lastSeen || item.time > existing.lastSeen)) {
      existing.lastSeen = item.time;
    }
  }

  return [...groups.values()].toSorted((a, b) => b.count - a.count);
}

function queueSummary(item: {
  code: string;
  enabled: boolean;
  id: string;
  name: string;
  optimisticLock: number;
  orgId: string;
  tenantId: string;
}) {
  return {
    code: item.code,
    enabled: item.enabled,
    id: item.id,
    name: item.name,
    optimisticLock: item.optimisticLock,
    orgId: item.orgId,
    tenantId: item.tenantId,
  };
}

// 工单分析仅向模型提供处理所需的状态与归属，不传联系人、消息正文和附件。
function ticketSummary(item: {
  assigneeId?: string;
  id: string;
  orgId?: string;
  priority: string;
  queueId: string;
  status: string;
  tenantId?: string;
}) {
  return {
    assigneeId: item.assigneeId,
    id: item.id,
    orgId: item.orgId,
    priority: item.priority,
    queueId: item.queueId,
    status: item.status,
    tenantId: item.tenantId,
  };
}

// 基础业务模块明确登记可供 Agent 使用的接口，执行始终沿用当前用户的请求客户端。
export const oakBaseAgentSkills: readonly AgentSkill[] = [
  {
    id: 'com.levin.oak.base.ticket.list',
    description:
      '分页分析当前用户有权查看的客服工单状态、优先级和队列。可指定 tenantId、orgId、status、queueId、limit、pageIndex。',
    inputSchema: {
      required: [],
      properties: {
        tenantId: { type: 'string', maxLength: 128 },
        orgId: { type: 'string', maxLength: 128 },
        status: { type: 'string', maxLength: 32 },
        queueId: { type: 'string', maxLength: 128 },
        limit: { type: 'integer', maximum: 20 },
        pageIndex: { type: 'integer', maximum: 5 },
      },
    },
    maxRecords: 20,
    permission: '客服工单查询权限',
    available: () => hasTicketPermission('list'),
    risk: 'read',
    execute: async (args) => {
      // 查询条件逐项校验，分页和范围仍交由当前用户的原业务接口最终授权。
      agentExactKeys(args, [
        'tenantId',
        'orgId',
        'status',
        'queueId',
        'limit',
        'pageIndex',
      ]);
      const tenantId = optionalAgentId(args.tenantId, '租户 ID');
      const orgId = optionalAgentId(args.orgId, '组织 ID');
      const queueId = optionalAgentId(args.queueId, '队列 ID');
      const status = safeTicketStatus(args.status);
      const limit = agentLimit(args.limit, 20);
      const pageIndex =
        args.pageIndex === undefined ? 1 : agentLimit(args.pageIndex, 5);
      const response = await ticketService.list({
        tenantId,
        orgId,
        queueId,
        status,
        pageIndex,
        pageSize: limit,
      });
      if (!response || !Array.isArray(response.items))
        throw new Error('工单列表接口返回格式不正确');
      const items = Array.isArray(response?.items)
        ? response.items.slice(0, limit).map((item) => ticketSummary(item))
        : [];
      return {
        count: items.length,
        data: {
          hasMore:
            typeof response?.totals === 'number' &&
            pageIndex * limit < response.totals,
          items,
          pageIndex,
          total: response?.totals,
        },
        source: '客服工单列表接口',
      };
    },
  },
  {
    id: 'com.levin.oak.base.ticket.retrieve',
    description:
      '查看当前用户有权访问的一条客服工单状态和优先级。参数 id，可选 tenantId、orgId。',
    inputSchema: {
      required: ['id'],
      properties: {
        id: { type: 'string', maxLength: 128 },
        tenantId: { type: 'string', maxLength: 128 },
        orgId: { type: 'string', maxLength: 128 },
      },
    },
    maxRecords: 1,
    permission: '客服工单详情权限',
    available: () => hasTicketPermission('retrieve'),
    risk: 'read',
    execute: async (args) => {
      // 详情只返回状态摘要，不将客户邮箱、工单消息和附件交给模型。
      agentExactKeys(args, ['id', 'tenantId', 'orgId']);
      const id = agentId(args.id, '工单 ID');
      const tenantId = optionalAgentId(args.tenantId, '租户 ID');
      const orgId = optionalAgentId(args.orgId, '组织 ID');
      const item = await ticketService.retrieve({ id, tenantId, orgId });
      return {
        count: item ? 1 : 0,
        data: item ? ticketSummary(item) : null,
        source: '客服工单详情接口',
      };
    },
  },
  {
    id: 'com.levin.oak.base.ticketQueue.list',
    description:
      '分页查询指定租户和组织内有权查看的工单受理队列。参数 tenantId、orgId、limit、pageIndex（1 到 5）。',
    inputSchema: {
      required: ['tenantId', 'orgId'],
      properties: {
        tenantId: { type: 'string', maxLength: 128 },
        orgId: { type: 'string', maxLength: 128 },
        limit: { type: 'integer', maximum: 20 },
        pageIndex: { type: 'integer', maximum: 5 },
      },
    },
    maxRecords: 20,
    permission: '工单受理队列查询权限',
    available: () => hasQueuePermission('list'),
    risk: 'read',
    execute: async (args) => {
      agentExactKeys(args, ['tenantId', 'orgId', 'limit', 'pageIndex']);
      const tenantId = agentId(args.tenantId, '租户 ID');
      const orgId = agentId(args.orgId, '组织 ID');
      const limit = agentLimit(args.limit, 20);
      const pageIndex =
        args.pageIndex === undefined ? 1 : agentLimit(args.pageIndex, 5);
      const response = await ticketQueueService.list({
        tenantId,
        orgId,
        pageIndex,
        pageSize: limit,
      });
      if (!response || !Array.isArray(response.items))
        throw new Error('队列列表接口返回格式不正确');
      const items = Array.isArray(response?.items)
        ? response.items.slice(0, limit).map((item) => queueSummary(item))
        : [];
      return {
        count: items.length,
        data: {
          hasMore:
            typeof response?.totals === 'number' &&
            pageIndex * limit < response.totals,
          items,
          pageIndex,
          total: response?.totals,
        },
        source: '工单受理队列列表接口',
      };
    },
  },
  {
    id: 'com.levin.oak.base.ticketQueue.retrieve',
    description:
      '查看指定租户和组织内一条有权访问的工单受理队列。参数 tenantId、orgId、id。',
    inputSchema: {
      required: ['tenantId', 'orgId', 'id'],
      properties: {
        tenantId: { type: 'string', maxLength: 128 },
        orgId: { type: 'string', maxLength: 128 },
        id: { type: 'string', maxLength: 128 },
      },
    },
    maxRecords: 1,
    permission: '工单受理队列详情权限',
    available: () => hasQueuePermission('retrieve'),
    risk: 'read',
    execute: async (args) => {
      agentExactKeys(args, ['tenantId', 'orgId', 'id']);
      const tenantId = agentId(args.tenantId, '租户 ID');
      const orgId = agentId(args.orgId, '组织 ID');
      const id = agentId(args.id, '队列 ID');
      const item = await ticketQueueService.retrieve({ tenantId, orgId, id });
      return {
        count: item ? 1 : 0,
        data: item ? queueSummary(item) : null,
        source: '工单受理队列详情接口',
      };
    },
  },
  {
    id: 'com.levin.oak.base.ticketQueue.setEnabled',
    writeIntent: ['启用', '停用', '开启', '关闭', 'enable', 'disable'],
    description:
      '按用户明确要求启停一条工单受理队列。参数 id、enabled；未选择单一组织时提供 tenantId、orgId。须在聊天内确认。',
    inputSchema: {
      required: ['id', 'enabled'],
      properties: {
        id: { type: 'string', maxLength: 128 },
        enabled: { type: 'boolean' },
        tenantId: { type: 'string', maxLength: 128 },
        orgId: { type: 'string', maxLength: 128 },
      },
    },
    maxRecords: 1,
    permission: '工单受理队列启停权限',
    available: () =>
      hasQueuePermission('setEnabled') && hasQueuePermission('retrieve'),
    risk: 'confirm',
    preview: async (args) => {
      agentExactKeys(args, ['id', 'enabled', 'tenantId', 'orgId']);
      const id = agentId(args.id, '队列 ID');
      if (typeof args.enabled !== 'boolean')
        throw new Error('enabled 必须是布尔值');
      // 显式范围与当前选择冲突时拒绝，不能默默改用另一条业务范围。
      if (
        (args.tenantId !== undefined &&
          currentGlobalTenantId.value &&
          args.tenantId !== currentGlobalTenantId.value) ||
        (args.orgId !== undefined &&
          currentGlobalOrgId.value &&
          args.orgId !== currentGlobalOrgId.value)
      )
        throw new Error('请求范围与当前选择不一致');
      const tenantId =
        currentGlobalTenantId.value || agentId(args.tenantId, '租户 ID');
      const orgId = currentGlobalOrgId.value || agentId(args.orgId, '组织 ID');
      if (!tenantId || !orgId)
        throw new Error('启停队列前需确定当前单一租户和组织');
      const item = await ticketQueueService.retrieve({ tenantId, orgId, id });
      if (
        !item ||
        item.id !== id ||
        item.tenantId !== tenantId ||
        item.orgId !== orgId ||
        !Number.isInteger(item.optimisticLock)
      ) {
        throw new Error('队列范围或版本信息不正确');
      }
      const targetEnabled = args.enabled;
      const description = `工单队列「${item.name.slice(0, 80)}」(${id})：${item.enabled ? '启用' : '停用'} → ${targetEnabled ? '启用' : '停用'}`;
      return {
        description,
        source: '工单受理队列详情接口',
        recheck: async () => {
          const latest = await ticketQueueService.retrieve({
            tenantId: item.tenantId,
            orgId: item.orgId,
            id: item.id,
          });
          return (
            latest.tenantId === item.tenantId &&
            latest.orgId === item.orgId &&
            latest.enabled === targetEnabled
          );
        },
        execute: async () => {
          const latest = await ticketQueueService.retrieve({
            tenantId: item.tenantId,
            orgId: item.orgId,
            id: item.id,
          });
          if (
            latest.optimisticLock !== item.optimisticLock ||
            latest.tenantId !== item.tenantId ||
            latest.orgId !== item.orgId
          ) {
            throw new Error('队列已变化，请重新发起操作');
          }
          if (latest.enabled === targetEnabled)
            return '队列已是目标状态，无需重复操作。';
          await ticketQueueService.setEnabled({
            tenantId: item.tenantId,
            orgId: item.orgId,
            id: item.id,
            optimisticLock: item.optimisticLock,
            enabled: targetEnabled,
          });
          const verified = await ticketQueueService.retrieve({
            tenantId: item.tenantId,
            orgId: item.orgId,
            id: item.id,
          });
          if (
            verified.id !== item.id ||
            verified.tenantId !== item.tenantId ||
            verified.orgId !== item.orgId ||
            verified.enabled !== targetEnabled
          )
            throw new Error('执行结果核验不一致，请检查队列状态');
          return `${description}，已执行并核验。`;
        },
      };
    },
  },
  {
    id: 'com.levin.oak.base.accessLog.diagnose',
    description:
      '查询后端异常摘要，用证据分析根因。参数 from、to、limit，可选 requestTraceId；时间最长 24 小时。',
    inputSchema: {
      required: ['from', 'to'],
      properties: {
        from: { type: 'string', maxLength: 19 },
        to: { type: 'string', maxLength: 19 },
        limit: { type: 'integer', maximum: 50 },
        requestTraceId: { type: 'string', maxLength: 128 },
      },
    },
    maxRecords: 50,
    permission: 'superAdmin',
    risk: 'read',
    execute: async (args, superAdmin) => {
      if (!superAdmin) throw new Error('此账号不能使用后端异常诊断');
      agentExactKeys(args, ['from', 'to', 'limit', 'requestTraceId']);
      const { from, to, limit } = diagnosticWindow(args);
      const trace = args.requestTraceId;
      if (
        trace !== undefined &&
        (typeof trace !== 'string' || !/^[\w-]{1,128}$/.test(trace))
      ) {
        throw new Error('请求跟踪 ID 格式不正确');
      }
      const response = await oakBaseGet<DiagnosticEntry[]>(
        '/AccessLogDiagnostics/exceptions',
        {
          params: { from, to, limit, requestTraceId: trace },
        },
      );
      if (!Array.isArray(response))
        throw new Error('异常诊断接口返回格式不正确');
      const items = Array.isArray(response) ? response.slice(0, limit) : [];
      return {
        count: items.length,
        data: { groups: groupDiagnosticEvidence(items) },
        source: '访问日志异常诊断接口',
      };
    },
  },
  {
    id: 'com.levin.oak.base.errorFiles.diagnose',
    description:
      '查询固定来源的后端 ERROR 日志证据（异常类型、应用栈帧和指纹），可与访问日志交叉分析；参数 from、to、limit，最长 24 小时。',
    inputSchema: {
      required: ['from', 'to'],
      properties: {
        from: { type: 'string', maxLength: 19 },
        to: { type: 'string', maxLength: 19 },
        limit: { type: 'integer', maximum: 50 },
      },
    },
    maxRecords: 50,
    permission: 'superAdmin',
    risk: 'read',
    execute: async (args, superAdmin) => {
      if (!superAdmin) throw new Error('此账号不能使用后端错误日志诊断');
      agentExactKeys(args, ['from', 'to', 'limit']);
      const { from, to, limit } = diagnosticWindow(args);
      const response = await oakBaseGet<{
        items?: DiagnosticEntry[];
        truncated?: boolean;
      }>('/AccessLogDiagnostics/errorFiles', { params: { from, to, limit } });
      if (!response || !Array.isArray(response.items))
        throw new Error('错误日志证据接口返回格式不正确');
      const items = Array.isArray(response?.items)
        ? response.items.slice(0, limit)
        : [];
      return {
        count: items.length,
        data: {
          groups: groupDiagnosticEvidence(items),
          truncated: response?.truncated === true,
        },
        source: '服务端 ERROR 日志证据接口',
      };
    },
  },
];
