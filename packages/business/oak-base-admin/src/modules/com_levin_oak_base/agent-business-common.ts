import type { AgentSkill } from '@levin/admin-framework';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';

import {
  agentExactKeys,
  agentId,
  agentLimit,
  currentGlobalOrgId,
  currentGlobalTenantId,
} from '@levin/admin-framework';
import {
  getResAuthorizeMeta,
  hasResAuthorizeMeta,
} from '@levin/admin-framework/framework-commons/api-authorize';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { omitNonPlatformTenantId } from '@levin/admin-framework/framework-commons/shared/crud-retrieve-context';
import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';

export interface AgentBusinessFilter {
  kind: 'boolean' | 'code' | 'id' | 'integer' | 'text' | 'time';
  maximum?: number;
  maxLength?: number;
}

export interface AgentReadOptions {
  actions?: readonly ('list' | 'retrieve')[];
  fields: readonly string[];
  filters?: Record<string, AgentBusinessFilter>;
  list?: (args: Record<string, any>) => Promise<any>;
  resource: string;
  retrieve?: (args: Record<string, any>) => Promise<any>;
  scope?: boolean;
  service: object;
  title: string;
}

// 权限元数据缺失或读取失败时关闭技能，执行前仍会再次检查当前权限。
export function agentPermission(service: object, method: string): boolean {
  try {
    const handler = (service as Record<string, any>)[method];
    if (typeof handler !== 'function' || !hasResAuthorizeMeta(handler))
      return false;
    const meta = getResAuthorizeMeta(handler);
    if (meta.onlyRequireAuthenticated || meta.ignored)
      return Boolean(useAccessStore().accessToken);
    const required = buildApiMethodPermissions(service, method);
    return required.length > 0 && useRbacAccess().hasPermission(required);
  } catch {
    return false;
  }
}

// 仅复制业务显式登记的原始值，拒绝把关联对象、自由结构或完整正文带入模型。
export function projectAgentRecord(value: unknown, fields: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('业务接口返回了无效记录');
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const primitive = (entry: unknown) =>
    entry === null ||
    typeof entry === 'boolean' ||
    (typeof entry === 'number' && Number.isFinite(entry)) ||
    typeof entry === 'string';
  const bounded = (entry: unknown) =>
    typeof entry === 'string' ? entry.slice(0, 160) : entry;
  for (const field of fields) {
    if (
      !Object.hasOwn(source, field) ||
      ['__proto__', 'constructor', 'prototype'].includes(field)
    )
      continue;
    const entry = source[field];
    if (primitive(entry)) result[field] = bounded(entry);
    else if (Array.isArray(entry) && entry.every((item) => primitive(item)))
      result[field] = entry.slice(0, 10).map((item) => bounded(item));
  }
  return result;
}

// 通用多租户 DTO 的租户身份由服务端注入；浏览器仅保留经核验的范围意图。
export function agentGenericRequest<T extends Record<string, any>>(args: T): T {
  return omitNonPlatformTenantId(args, isPlatformUser(useUserStore().userInfo));
}

// 全局选择器只是请求范围约束；最终记录权限由原业务接口实施。
export function agentBusinessScope(args: Record<string, unknown>) {
  const result: Record<string, string> = {};
  for (const [key, selected] of [
    ['tenantId', currentGlobalTenantId.value],
    ['orgId', currentGlobalOrgId.value],
  ] as const) {
    const requested =
      args[key] === undefined ? undefined : agentId(args[key], key);
    if (selected && requested && selected !== requested)
      throw new Error('请求范围与当前选择不一致');
    if (selected || requested)
      result[key] = agentId(selected || requested, key);
  }
  const user = useUserStore().userInfo;
  if (
    !isPlatformUser(user) &&
    result.tenantId &&
    result.tenantId !== user?.tenantId
  )
    throw new Error('请求租户不属于当前登录用户');
  return result;
}

function filterValue(
  value: unknown,
  field: string,
  filter: AgentBusinessFilter,
) {
  if (filter.kind === 'id') return agentId(value, field);
  if (filter.kind === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${field} 必须是布尔值`);
    return value;
  }
  if (filter.kind === 'integer') {
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 0 ||
      Number(value) > (filter.maximum ?? 1_000_000)
    )
      throw new Error(`${field} 整数范围不正确`);
    return value;
  }
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > (filter.maxLength ?? 128) ||
    [...value].some((character) => (character.codePointAt(0) ?? 32) < 32)
  )
    throw new Error(`${field} 文本格式不正确`);
  if (filter.kind === 'code' && !/^[\w.-]+$/.test(value))
    throw new Error(`${field} 编码格式不正确`);
  if (
    filter.kind === 'time' &&
    (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(value) ||
      Number.isNaN(Date.parse(value)))
  )
    throw new Error(`${field} 时间格式不正确`);
  return value;
}

// 显式资源描述生成固定查询技能，不扫描运行时服务或开放模型指定的接口路径。
export function agentReadSkills(options: AgentReadOptions): AgentSkill[] {
  const {
    resource,
    title,
    service,
    fields,
    filters = {},
    scope = true,
  } = options;
  return (options.actions ?? ['list', 'retrieve']).map((action): AgentSkill => {
    const properties: AgentSkill['inputSchema']['properties'] = {};
    if (scope) {
      properties.tenantId = { type: 'string', maxLength: 128 };
      properties.orgId = { type: 'string', maxLength: 128 };
    }
    if (action === 'list') {
      properties.limit = { type: 'integer', maximum: 20 };
      properties.pageIndex = { type: 'integer', maximum: 5 };
      for (const [field, filter] of Object.entries(filters)) {
        if (['id', 'limit', 'orgId', 'pageIndex', 'tenantId'].includes(field))
          throw new Error('业务过滤字段与保留参数冲突');
        if (filter.kind === 'boolean') properties[field] = { type: 'boolean' };
        else if (filter.kind === 'integer')
          properties[field] = {
            type: 'integer',
            maximum: filter.maximum ?? 1_000_000,
          };
        else
          properties[field] = {
            type: 'string',
            maxLength: filter.maxLength ?? 128,
          };
      }
    } else properties.id = { type: 'string', maxLength: 128 };
    return {
      id: `com.levin.oak.base.${resource}.${action}`,
      description: `${action === 'list' ? '分页查询分析' : '查看一条'}当前用户有权访问的${title}摘要。参数：${Object.keys(properties).join('、')}。不返回敏感资料。`,
      inputSchema: {
        required: action === 'retrieve' ? ['id'] : [],
        properties,
      },
      maxRecords: action === 'list' ? 20 : 1,
      permission: `${title}${action === 'list' ? '查询' : '详情'}权限`,
      available: () => agentPermission(service, action),
      risk: 'read',
      execute: async (args) => {
        agentExactKeys(args, Object.keys(properties));
        if (!agentPermission(service, action))
          throw new Error('当前用户无权执行此业务技能');
        const params: Record<string, unknown> = scope
          ? agentBusinessScope(args)
          : {};
        const selectedTenant = currentGlobalTenantId.value;
        const selectedOrg = currentGlobalOrgId.value;
        const verifyCurrentAccess = () => {
          if (
            !agentPermission(service, action) ||
            selectedTenant !== currentGlobalTenantId.value ||
            selectedOrg !== currentGlobalOrgId.value
          )
            throw new Error('查询期间权限或范围已变化');
        };
        const method =
          options[action] ?? (service as Record<string, unknown>)[action];
        if (typeof method !== 'function') throw new Error('业务接口未登记');
        if (action === 'retrieve') {
          params.id = agentId(args.id, '记录 ID');
          const item = await method.call(
            service,
            options.retrieve ? params : agentGenericRequest(params),
          );
          verifyCurrentAccess();
          return {
            count: item === null || item === undefined ? 0 : 1,
            data:
              item === null || item === undefined
                ? null
                : projectAgentRecord(item, fields),
            source: `${title}详情接口`,
          };
        }
        const limit = agentLimit(args.limit, 20);
        const pageIndex =
          args.pageIndex === undefined ? 1 : agentLimit(args.pageIndex, 5);
        for (const [field, filter] of Object.entries(filters))
          if (args[field] !== undefined)
            params[field] = filterValue(args[field], field, filter);
        const request = { ...params, pageIndex, pageSize: limit };
        const response = await method.call(
          service,
          options.list ? request : agentGenericRequest(request),
        );
        verifyCurrentAccess();
        if (!response || !Array.isArray(response.items))
          throw new Error('业务列表接口返回格式不正确');
        const items = response.items
          .slice(0, limit)
          .map((item: unknown) => projectAgentRecord(item, fields));
        const total =
          Number.isSafeInteger(response.totals) && response.totals >= 0
            ? response.totals
            : undefined;
        return {
          count: items.length,
          data: {
            items,
            pageIndex,
            total,
            hasMore:
              total === undefined ? undefined : pageIndex * limit < total,
          },
          source: `${title}列表接口`,
        };
      },
    };
  });
}
