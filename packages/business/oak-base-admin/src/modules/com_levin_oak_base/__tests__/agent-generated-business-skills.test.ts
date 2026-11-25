import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generatedBusinessSkills } from '../agent-generated-business-skills';

const mocks = vi.hoisted(() => ({
  allowed: true,
  list: vi.fn(),
  update: vi.fn(),
  scope: {} as Record<string, string>,
}));
vi.mock('../api/generated-agent-services', () => ({
  generatedAgentServices: {
    CustomerService: { list: mocks.list, update: mocks.update },
  },
}));
vi.mock('../agent-business-common', () => ({
  agentPermission: () => mocks.allowed,
  agentBusinessScope: () => mocks.scope,
  agentGenericRequest: (value: unknown) => value,
  projectAgentRecord: (row: Record<string, unknown>, fields: string[]) =>
    Object.fromEntries(
      Object.entries(row).filter(([key]) => fields.includes(key)),
    ),
}));

const searchExecute = generatedBusinessSkills[0]?.execute;
const readExecute = generatedBusinessSkills[1]?.execute;
const writePreview = generatedBusinessSkills[2]?.preview;
if (!searchExecute || !readExecute || !writePreview)
  throw new Error('缺少业务技能');
beforeEach(() => {
  mocks.allowed = true;
  mocks.scope = {};
  mocks.list.mockReset();
  mocks.update.mockReset();
});
describe('自动绑定的业务接口技能', () => {
  it('搜索只返回当前有权限的原服务接口', async () => {
    const result = await searchExecute({ query: 'CustomerService' }, false);
    expect(JSON.stringify(result.data)).toContain('CustomerService');
    mocks.allowed = false;
    const denied = await searchExecute({ query: 'CustomerService' }, false);
    expect(denied.count).toBe(0);
  });
  it('只读操作调用原服务并裁剪敏感返回字段', async () => {
    mocks.list.mockResolvedValue({
      items: [{ id: '1', name: '客户', password: 'secret' }],
    });
    const result = await readExecute(
      { service: 'CustomerService', method: 'list', data: '{}' },
      false,
    );
    expect(mocks.list).toHaveBeenCalledWith({});
    expect(JSON.stringify(result)).not.toContain('secret');
    mocks.allowed = false;
    await expect(
      readExecute(
        { service: 'CustomerService', method: 'list', data: '{}' },
        false,
      ),
    ).rejects.toThrow('权限');
  });
  it('普通写操作先预览，确认时再次检查权限', async () => {
    const pending = await writePreview({
      service: 'CustomerService',
      method: 'update',
      data: '{"id":"1","name":"新名称"}',
    });
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.allowed = false;
    await expect(pending.execute()).rejects.toThrow('权限');
    mocks.allowed = true;
    await pending.execute();
    expect(mocks.update).toHaveBeenCalledWith({ id: '1', name: '新名称' });
  });
  it('确认时选择范围发生变化则拒绝执行', async () => {
    mocks.scope = { tenantId: 'one' };
    const pending = await writePreview({
      service: 'CustomerService',
      method: 'update',
      data: '{"id":"1"}',
    });
    mocks.scope = { tenantId: 'two' };
    expect(await pending.recheck()).toBe(false);
    await expect(pending.execute()).rejects.toThrow('范围已变化');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('拒绝受保护字段、未登记方法和危险动作', async () => {
    await expect(
      writePreview({
        service: 'CustomerService',
        method: 'update',
        data: '{"password":"x"}',
      }),
    ).rejects.toThrow('受保护');
    await expect(
      readExecute(
        { service: 'CustomerService', method: 'notRegistered', data: '{}' },
        false,
      ),
    ).rejects.toThrow('业务服务绑定');
    await expect(
      writePreview({
        service: 'CustomerService',
        method: 'delete',
        data: '{}',
      }),
    ).rejects.toThrow();
  });
});
