import type { AgentSkill } from '@levin/admin-framework';

import { agentExactKeys, agentLimit } from '@levin/admin-framework';

import {
  agentBusinessScope,
  agentGenericRequest,
  agentPermission,
  projectAgentRecord,
} from './agent-business-common';
import catalog from './api/agent-api-candidates.json';
import { generatedAgentServices } from './api/generated-agent-services';

// 这些能力须走专门的业务流程或涉及凭证及资金，不能通过通用参数透传。
const forbidden =
  /password|credential|secret|token|api.?key|login|rbac|role|permission|script|codegen|webhook|payment|refund|payable|fundaccount|fundexchange|settlement|invoice|contract|sign|approve|publish|delete|remove|send|upload|download|transfer|批量删除|删除|发送|上传|下载|转账|支付|退款|签署|审批|发布|权限|凭证|密码|密钥|脚本/i;
const readActions = new Set(['查看详情', '查询列表', '统计']);
const readMethods = new Set(['list', 'retrieve', 'stat']);
const fields = [
  'id',
  'code',
  'name',
  'title',
  'status',
  'state',
  'createTime',
  'lastUpdateTime',
];

type Entry = (typeof catalog.candidates)[number];
function getEntry(
  owner: string,
  method: string,
): { entry: Entry; service: object } {
  if (!/^[A-Z]\w{0,100}$/i.test(owner) || !/^[A-Z]\w{0,100}$/i.test(method))
    throw new Error('接口标识无效');
  const service = generatedAgentServices[owner];
  const matches = catalog.candidates.filter(
    (entry) =>
      entry.owner === owner &&
      entry.method === method &&
      entry.permissionMetadata &&
      entry.controllerClass,
  );
  if (!service || matches.length !== 1)
    throw new Error('接口没有唯一的业务服务绑定');
  const entry = matches[0];
  if (!entry) throw new Error('接口没有唯一的业务服务绑定');
  if (entry.parameters.slice(1).some((parameter) => !parameter.optional))
    throw new Error('接口需要多个必填参数，需专门接入');
  if (
    forbidden.test(
      `${owner} ${method} ${entry.action ?? ''} ${entry.title ?? ''}`,
    )
  )
    throw new Error('该接口需要专门的业务技能');
  if (!agentPermission(service, method))
    throw new Error('当前用户无此接口权限');
  return { entry, service };
}
function isRead(entry: Entry) {
  return (
    readActions.has(entry.action ?? '') && readMethods.has(entry.method ?? '')
  );
}
function input(args: Record<string, unknown>) {
  agentExactKeys(args, ['service', 'method', 'data']);
  if (
    typeof args.service !== 'string' ||
    typeof args.method !== 'string' ||
    typeof args.data !== 'string' ||
    args.data.length > 8000
  )
    throw new Error('接口参数无效');
  let data: unknown;
  try {
    data = JSON.parse(args.data);
  } catch {
    throw new Error('接口参数不是合法 JSON');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('接口参数须为 JSON 对象');
  const check = (value: unknown, depth = 0): void => {
    if (depth > 5) throw new Error('接口参数嵌套过深');
    if (Array.isArray(value)) {
      if (value.length > 20) throw new Error('接口参数数组过长');
      value.forEach((v) => check(v, depth + 1));
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (
          ['__proto__', 'constructor', 'prototype'].includes(key) ||
          /^(?:where|sql|jpql|hql|expression|spel|script|orderBy|select|queryStatement)$/i.test(
            key,
          ) ||
          key.startsWith('$') ||
          forbidden.test(key)
        )
          throw new Error('参数包含受保护字段');
        check(item, depth + 1);
      }
    }
  };
  check(data);
  return {
    owner: args.service,
    method: args.method,
    data: agentGenericRequest({
      ...(data as Record<string, unknown>),
      ...agentBusinessScope(data as Record<string, unknown>),
    }),
  };
}
function safeResult(raw: any): {
  count: number;
  data: unknown;
  source: string;
} {
  let rows: unknown[] = [];
  if (Array.isArray(raw)) rows = raw;
  else if (Array.isArray(raw?.items)) rows = raw.items;
  else if (Array.isArray(raw?.list)) rows = raw.list;
  else if (raw && typeof raw === 'object') rows = [raw];
  const items = rows
    .slice(0, 20)
    .map((row: unknown) => projectAgentRecord(row, fields));
  return {
    source: '当前用户授权的业务接口',
    count: items.length,
    data: { items },
  };
}
async function invoke(service: object, method: string, data: object) {
  const handler = (service as Record<string, unknown>)[method];
  if (typeof handler !== 'function') throw new Error('业务服务方法不可用');
  return handler.call(service, data);
}

const properties = {
  service: { type: 'string' as const, maxLength: 100 },
  method: { type: 'string' as const, maxLength: 100 },
  data: { type: 'string' as const, maxLength: 8000 },
};
const schema = { required: ['service', 'method', 'data'], properties };

export const generatedBusinessSkills: AgentSkill[] = [
  {
    id: 'com.levin.oak.base.generatedApi.search',
    description:
      '搜索当前用户有权使用的自动接入业务接口；返回服务、方法和操作类型。',
    risk: 'read',
    permission: '当前接口权限',
    maxRecords: 20,
    inputSchema: {
      required: ['query'],
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 80 },
        pageIndex: { type: 'integer', minimum: 1, maximum: 1000 },
      },
    },
    execute: async (args) => {
      agentExactKeys(args, ['query', 'pageIndex']);
      const query = String(args.query).trim().toLowerCase();
      const page =
        args.pageIndex === undefined ? 1 : agentLimit(args.pageIndex, 1000);
      const found = catalog.candidates.filter((entry) => {
        if (
          !entry.owner ||
          !entry.method ||
          !`${entry.title ?? ''} ${entry.owner} ${entry.method} ${entry.action ?? ''}`
            .toLowerCase()
            .includes(query)
        )
          return false;
        try {
          getEntry(entry.owner, entry.method);
          return true;
        } catch {
          return false;
        }
      });
      const items = found.slice((page - 1) * 20, page * 20).map((entry) => ({
        service: entry.owner,
        method: entry.method,
        title: entry.title,
        action: entry.action,
        risk: isRead(entry) ? 'read' : 'confirm',
        parameters: entry.parameters,
      }));
      return {
        source: '授权业务接口目录',
        count: items.length,
        data: { items, pageIndex: page, hasMore: found.length > page * 20 },
      };
    },
  },
  {
    id: 'com.levin.oak.base.generatedApi.read',
    description: '调用搜索结果中的只读业务接口；data 是 JSON 对象字符串。',
    risk: 'read',
    permission: '当前接口权限',
    maxRecords: 20,
    inputSchema: schema,
    execute: async (args) => {
      const { owner, method, data } = input(args);
      const { entry, service } = getEntry(owner, method);
      if (!isRead(entry)) throw new Error('此接口不是只读接口');
      const result = await invoke(service, method, data);
      return safeResult(result);
    },
  },
  {
    id: 'com.levin.oak.base.generatedApi.write',
    description:
      '预览并确认执行搜索结果中的普通业务变更；data 是 JSON 对象字符串。',
    risk: 'confirm',
    permission: '当前接口权限',
    maxRecords: 1,
    writeIntent: [
      '创建',
      '新增',
      '修改',
      '更新',
      '设置',
      '配置',
      '保存',
      '启用',
      '停用',
    ],
    inputSchema: schema,
    preview: async (args) => {
      const { owner, method, data } = input(args);
      const { entry } = getEntry(owner, method);
      if (isRead(entry)) throw new Error('只读接口请使用查询技能');
      return {
        description: `确认执行 ${entry.title ?? owner} / ${entry.action ?? method}，参数：${JSON.stringify(data)}`,
        source: '当前用户授权的业务接口',
        recheck: async () => {
          try {
            getEntry(owner, method);
            return JSON.stringify(input(args).data) === JSON.stringify(data);
          } catch {
            return false;
          }
        },
        execute: async () => {
          const { service } = getEntry(owner, method);
          if (JSON.stringify(input(args).data) !== JSON.stringify(data))
            throw new Error('当前范围已变化，请重新预览');
          await invoke(service, method, data);
          return '业务接口已执行，请在业务页面核对结果。';
        },
      };
    },
  },
];
