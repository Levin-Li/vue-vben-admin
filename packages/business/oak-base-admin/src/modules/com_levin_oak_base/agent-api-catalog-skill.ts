import type { AgentSkill } from '@levin/admin-framework';

import {
  agentExactKeys,
  agentLimit,
  listAdminAgentSkills,
} from '@levin/admin-framework';

/** 已授权技能可被发现；未授权候选仅供超级管理员检查。 */
export const agentApiCatalogSkill: AgentSkill = {
  id: 'com.levin.oak.base.agentApi.searchCandidates',
  description:
    '搜索已授权的业务接口技能；超级管理员也可查看未开放的扫描候选。使用业务名称或接口名搜索。',
  inputSchema: {
    required: ['query'],
    properties: {
      query: { type: 'string', minLength: 2, maxLength: 80 },
      limit: { type: 'integer', minimum: 1, maximum: 20 },
      pageIndex: { type: 'integer', minimum: 1, maximum: 1000 },
    },
  },
  maxRecords: 20,
  permission: '已登录用户的技能范围',
  risk: 'read',
  execute: async (args, superAdmin) => {
    agentExactKeys(args, ['query', 'limit', 'pageIndex']);
    if (
      typeof args.query !== 'string' ||
      args.query.trim().length < 2 ||
      args.query.length > 80
    )
      throw new Error('搜索关键词长度必须为 2 到 80');
    const query = args.query.trim().toLocaleLowerCase();
    const limit = agentLimit(args.limit, 20);
    const pageIndex =
      args.pageIndex === undefined ? 1 : agentLimit(args.pageIndex, 1000);
    const offset = (pageIndex - 1) * limit;
    const { default: catalog } =
      await import('./api/agent-api-candidates.json');
    const identityCounts = new Map<string, number>();
    for (const entry of catalog.candidates) {
      if (!entry.controllerClass || !entry.method) continue;
      const key = `${entry.controllerClass}\u0000${entry.method}`;
      identityCounts.set(key, (identityCounts.get(key) ?? 0) + 1);
    }
    const bindings = new Map<string, string[]>();
    for (const skill of listAdminAgentSkills(superAdmin)) {
      for (const binding of skill.sourceBindings ?? []) {
        const key = `${binding.controllerClass}\u0000${binding.method}`;
        if (identityCounts.get(key) !== 1) continue;
        bindings.set(key, [...(bindings.get(key) ?? []), skill.id]);
      }
    }
    const matches = catalog.candidates.filter((entry) => {
      const key = `${entry.controllerClass ?? ''}\u0000${entry.method ?? ''}`;
      return (
        (superAdmin || bindings.has(key)) &&
        `${entry.title ?? ''} ${entry.action ?? ''} ${entry.owner ?? ''}.${entry.method ?? ''}`
          .toLocaleLowerCase()
          .includes(query)
      );
    });
    const items = matches.slice(offset, offset + limit).map((entry) => ({
      service: entry.owner,
      title: entry.title,
      method: entry.method,
      action: entry.action,
      hasPermissionMetadata: entry.permissionMetadata,
      skillIds:
        bindings.get(
          `${entry.controllerClass ?? ''}\u0000${entry.method ?? ''}`,
        ) ?? [],
      status: bindings.has(
        `${entry.controllerClass ?? ''}\u0000${entry.method ?? ''}`,
      )
        ? '已登记技能，执行时仍需权限校验'
        : '仅候选，未授权执行',
    }));
    return {
      count: items.length,
      data: { items, pageIndex, hasMore: matches.length > offset + limit },
      source: '本地接口目录（候选不代表授权）',
    };
  },
};
