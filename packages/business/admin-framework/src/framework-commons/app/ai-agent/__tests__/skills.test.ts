import { describe, expect, it, vi } from 'vitest';

import { safeAgentRouteHint } from '../chat';
import {
  confirmAgentWrite,
  executeAgentSkill,
  listAdminAgentSkills,
  parseAgentSkillCall,
  previewAgentWrite,
  registerAdminAgentSkills,
} from '../skills';

const inputSchema = { required: [], properties: {} };

describe('系统 Agent 技能注册边界', () => {
  it('拒绝未登记技能和额外请求字段', () => {
    registerAdminAgentSkills('example', [
      {
        id: 'example.read',
        inputSchema,
        description: '读取示例',
        maxRecords: 1,
        permission: 'read',
        risk: 'read',
        execute: async () => ({ count: 0, data: [], source: '示例' }),
      },
    ]);
    expect(() =>
      parseAgentSkillCall(
        JSON.stringify({
          type: 'skill_call',
          skill: 'arbitrary_http',
          arguments: { url: '/User/delete' },
        }),
      ),
    ).toThrow('未获准');
    expect(() =>
      parseAgentSkillCall(
        JSON.stringify({
          type: 'skill_call',
          skill: 'example.read',
          arguments: {},
          url: '/User/delete',
        }),
      ),
    ).toThrow('未登记字段');
  });

  it('非超级管理员无法调用受限技能', async () => {
    const execute = vi.fn(async () => ({
      count: 1,
      data: [{}],
      source: '示例',
    }));
    registerAdminAgentSkills('restricted', [
      {
        id: 'restricted.read',
        inputSchema,
        description: '受限查询',
        maxRecords: 1,
        permission: 'superAdmin',
        risk: 'read',
        execute,
      },
    ]);
    await expect(
      executeAgentSkill({ skill: 'restricted.read', arguments: {} }, false),
    ).rejects.toThrow('不可调用');
    expect(execute).not.toHaveBeenCalled();
    expect(
      listAdminAgentSkills(false).some((item) => item.id === 'restricted.read'),
    ).toBe(false);
    expect(
      listAdminAgentSkills(true).some((item) => item.id === 'restricted.read'),
    ).toBe(true);
  });

  it('目录与执行阶段都重新检查当前权限', async () => {
    let allowed = false;
    const execute = vi.fn(async () => ({ count: 1, data: {}, source: '示例' }));
    registerAdminAgentSkills('dynamic', [
      {
        id: 'dynamic.read',
        inputSchema,
        description: '动态查询',
        maxRecords: 1,
        permission: 'read',
        risk: 'read',
        available: () => allowed,
        execute,
      },
    ]);
    expect(
      listAdminAgentSkills(false).some((item) => item.id === 'dynamic.read'),
    ).toBe(false);
    allowed = true;
    expect(
      listAdminAgentSkills(false).some((item) => item.id === 'dynamic.read'),
    ).toBe(true);
    allowed = false;
    await expect(
      executeAgentSkill({ skill: 'dynamic.read', arguments: {} }, false),
    ).rejects.toThrow('不可调用');
    expect(execute).not.toHaveBeenCalled();
  });

  it('写入只有预览后才能调用，确认仅执行登记的闭包', async () => {
    const execute = vi.fn(async () => '已核验');
    registerAdminAgentSkills('write', [
      {
        id: 'write.change',
        inputSchema,
        description: '示例写入',
        maxRecords: 1,
        permission: 'write',
        risk: 'confirm',
        preview: async () => ({
          description: '变更预览',
          source: '示例',
          execute,
          recheck: async () => true,
        }),
      },
    ]);
    const call = { skill: 'write.change', arguments: {} };
    await expect(executeAgentSkill(call, true)).rejects.toThrow(
      '不允许直接执行',
    );
    const pending = await previewAgentWrite(call, true);
    expect(execute).not.toHaveBeenCalled();
    await expect(confirmAgentWrite(pending)).resolves.toBe('已核验');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('发送给模型的页面提示不包含任意路径段与查询令牌', () => {
    expect(safeAgentRouteHint('/ticket/abcSecret?token=private#anchor')).toBe(
      '未提供',
    );
  });
  it('参数Schema统一拒绝缺失、未知、类型、长度和范围参数', async () => {
    const execute = vi.fn();
    registerAdminAgentSkills('schema', [
      {
        id: 'schema.read',
        description: '校验',
        maxRecords: 2,
        permission: 'read',
        risk: 'read',
        execute,
        inputSchema: {
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1, maxLength: 3 },
            limit: { type: 'integer', minimum: 1, maximum: 2 },
            enabled: { type: 'boolean' },
          },
        },
      },
    ]);
    for (const args of [
      {},
      { id: 'a', extra: 1 },
      { id: 'abcd' },
      { id: 1 },
      { id: 'a', limit: 3 },
      { id: 'a', limit: 1.5 },
      { id: 'a', enabled: 'true' },
    ]) {
      await expect(
        executeAgentSkill({ skill: 'schema.read', arguments: args }, false),
      ).rejects.toThrow();
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it('确认和复查重新检查权限，失败提交也不能重复', async () => {
    let allowed = true;
    const execute = vi.fn().mockRejectedValue(new Error('网络中断'));
    registerAdminAgentSkills('revoke', [
      {
        id: 'revoke.change',
        inputSchema,
        description: '变更',
        maxRecords: 1,
        permission: 'write',
        risk: 'confirm',
        available: () => allowed,
        preview: async () => ({
          description: '预览',
          source: '示例',
          execute,
          recheck: async () => true,
        }),
      },
    ]);
    const pending = await previewAgentWrite(
      { skill: 'revoke.change', arguments: {} },
      false,
    );
    allowed = false;
    await expect(confirmAgentWrite(pending)).rejects.toThrow('不可调用');
    await expect(pending.recheck()).rejects.toThrow('不可调用');
    allowed = true;
    await expect(confirmAgentWrite(pending)).rejects.toThrow('网络中断');
    await expect(confirmAgentWrite(pending)).rejects.toThrow('禁止重复');
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('同一目录拒绝重复技能ID，避免Schema与执行处理器冲突', () => {
    const skill = {
      id: 'collision.read',
      inputSchema,
      description: '读取',
      maxRecords: 1,
      permission: 'read',
      risk: 'read' as const,
    };
    expect(() => registerAdminAgentSkills('collision', [skill, skill])).toThrow(
      '不得重复',
    );
  });
});
