import {
  registerAdminAgentModelTransport,
  registerAdminAgentSkills,
} from '@levin/admin-framework';
import { runAgentTurn } from '@levin/admin-framework/framework-commons/app/ai-agent/chat';
import { describe, expect, it, vi } from 'vitest';

import { agentApiCatalogSkill } from '../agent-api-catalog-skill';
import { agentReadSkills } from '../agent-business-common';
import { customerService } from '../api/customer-service';

const execute = agentApiCatalogSkill.execute;
if (!execute) throw new Error('缺少候选目录执行器');

describe('接口候选目录技能', () => {
  it('agent 能搜索已授权技能并通过原技能执行查询', async () => {
    const read = vi.fn().mockResolvedValue({
      count: 1,
      data: [{ id: 'customer-1' }],
      source: '客户列表',
    });
    registerAdminAgentSkills('fixture', [
      {
        id: 'fixture.customer.list',
        description: '客户查询',
        permission: 'read',
        risk: 'read',
        maxRecords: 20,
        inputSchema: { required: [], properties: {} },
        sourceBindings: [
          {
            controllerClass:
              'com.levin.oak.base.controller.BizCustomerController',
            method: 'list',
          },
        ],
        available: () => true,
        execute: read,
      },
    ]);
    registerAdminAgentSkills('com.levin.oak.base', [agentApiCatalogSkill]);
    const chat = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          type: 'skill_call',
          skill: agentApiCatalogSkill.id,
          arguments: { query: 'Customer' },
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          type: 'skill_call',
          skill: 'fixture.customer.list',
          arguments: {},
        }),
      )
      .mockResolvedValueOnce('查到一条客户记录');
    registerAdminAgentModelTransport({ chat, listProviders: async () => [] });
    const result = await runAgentTurn(
      [{ role: 'User', content: '查找客户接口并查询客户' }],
      '/',
      false,
      'deepseek',
      () => {},
    );
    expect(read).toHaveBeenCalledOnce();
    expect(result.message.content).toContain('查到一条客户记录');
    expect(JSON.stringify(chat.mock.calls[1])).toContain(
      'fixture.customer.list',
    );
    expect(JSON.stringify(chat.mock.calls[1])).not.toContain(
      '仅候选，未授权执行',
    );
  });
  it('实际客户查询技能绑定稳定控制器身份与固定方法', () => {
    const skills = agentReadSkills({
      resource: 'customer',
      title: '客户',
      service: customerService,
      fields: ['id'],
    });
    expect(
      skills.find((item) => item.id.endsWith('.list'))?.sourceBindings,
    ).toEqual([
      {
        controllerClass: 'com.levin.oak.base.controller.BizCustomerController',
        method: 'list',
      },
    ]);
  });
  it('普通用户只看到权限有效的明确绑定技能', async () => {
    let allowed = true;
    registerAdminAgentSkills('fixture', [
      {
        id: 'fixture.customer.list',
        description: '客户查询',
        permission: 'read',
        risk: 'read',
        maxRecords: 20,
        inputSchema: { required: [], properties: {} },
        sourceBindings: [
          {
            controllerClass:
              'com.levin.oak.base.controller.BizCustomerController',
            method: 'list',
          },
        ],
        available: () => allowed,
      },
    ]);
    const result = await execute({ query: 'Customer' }, false);
    const entries = (result.data as { items: Array<{ skillIds: string[] }> })
      .items;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.skillIds).toEqual(['fixture.customer.list']);
    allowed = false;
    const revoked = await execute({ query: 'Customer' }, false);
    expect(revoked.count).toBe(0);
  });

  it('超级管理员可搜索不可执行的候选摘要', async () => {
    const result = await execute({ query: 'Customer', limit: 2 }, true);
    expect(result.count).toBe(2);
    expect(result.source).toContain('候选不代表授权');
    const data = result.data as {
      hasMore: boolean;
      items: Array<{ status: string }>;
    };
    expect(
      data.items.every((item) => item.status === '仅候选，未授权执行'),
    ).toBe(true);
    expect(data.hasMore).toBe(true);
    const next = await execute(
      { query: 'Customer', limit: 2, pageIndex: 2 },
      true,
    );
    expect((next.data as { items: unknown[] }).items).not.toEqual(data.items);
    const chinese = await execute({ query: '客户' }, true);
    expect(chinese.count).toBeGreaterThan(0);
  });

  it('拒绝过短和无关参数', async () => {
    await expect(execute({ query: 'a' }, true)).rejects.toThrow();
    await expect(
      execute({ query: 'Customer', url: '/arbitrary' }, true),
    ).rejects.toThrow();
  });
});
