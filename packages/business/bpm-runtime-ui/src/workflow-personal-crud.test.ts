import { describe, expect, it, vi } from 'vitest';

import {
  createPersonalWorkflowCrudConfig,
  isPersonalWorkflowInstance,
  isPersonalWorkflowTask,
} from './workflow-personal-crud';

// 明确锁定只读适配、真实字段和服务端游标，不在前端推断总数或创造查询能力。
describe('个人流程标准CRUD配置', () => {
  it.each(['todo', 'done', 'started', 'copied'] as const)(
    '%s只调用真实读取方法并保留空页续读信号',
    async (tab) => {
      const result = { items: [], hasMore: true, nextCursor: 'page-two' };
      const load = vi.fn().mockResolvedValue(result);
      const path = `/example.module/V1/api/workflow-runtime/${tab}`;
      const config = createPersonalWorkflowCrudConfig(tab, load, {
        path,
        permissions: ['真实API权限'],
      });
      expect(config.apiBase).toBe(path);
      expect(config.dataAttrTargets?.list).toEqual({ method: 'GET', path });
      expect(config.queryPermission).toEqual(['真实API权限']);
      expect(config.paginationMode).toBe('cursor');
      expect(config.listTables?.[0]?.tableName).toBe(`personal-${tab}`);
      expect(config.allowCreate).toBe(false);
      expect(config.allowEdit).toBe(false);
      expect(config.allowDelete).toBe(false);
      expect(config.allowRetrieve).toBe(false);
      expect(config.allowExport).toBe(false);
      expect(Object.keys(config.apiService ?? {})).toEqual(['list']);
      expect(
        await config.apiService?.list?.({
          cursor: 'page-one',
          pageSize: 200,
          keyword: '不能本地伪查询',
        }),
      ).toBe(result);
      expect(load).toHaveBeenCalledWith({ cursor: 'page-one', size: 20 });
      expect(config.fields.some((field) => field.search)).toBe(false);
      expect(config.fields.some((field) => /time|date/i.test(field.key))).toBe(
        false,
      );
      expect(config.recordKey).toBe(
        tab === 'todo' || tab === 'done' ? 'taskId' : 'instanceId',
      );
    },
  );

  it('操作记录必须包含真实任务或实例必需字段', () => {
    expect(isPersonalWorkflowTask({ taskId: 'task-1' })).toBe(true);
    expect(isPersonalWorkflowTask({ taskId: '' })).toBe(false);
    expect(
      isPersonalWorkflowTask({ instanceId: 'instance-1', status: 'Running' }),
    ).toBe(false);
    expect(
      isPersonalWorkflowInstance({
        instanceId: 'instance-1',
        status: 'Running',
      }),
    ).toBe(true);
    expect(isPersonalWorkflowInstance({ instanceId: 'instance-1' })).toBe(
      false,
    );
    expect(isPersonalWorkflowInstance(null)).toBe(false);
  });

  it('状态列使用真实服务端状态，已办和实例状态分别表述', () => {
    const done = createPersonalWorkflowCrudConfig('done', vi.fn());
    expect(
      done.fields
        .find((field) => field.key === 'status')
        ?.tableValue?.({ status: 'Completed' }),
    ).toBe('已处理');
    const started = createPersonalWorkflowCrudConfig('started', vi.fn());
    expect(
      started.fields
        .find((field) => field.key === 'executionStatus')
        ?.tableValue?.({ status: 'Running' }),
    ).toBe('运行中');
    expect(
      started.fields
        .find((field) => field.key === 'outcome')
        ?.tableValue?.({ outcome: 'Rejected' }),
    ).toBe('拒绝');
  });
});
