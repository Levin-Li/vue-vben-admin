import { describe, expect, it } from 'vitest';

import {
  buildActionLogTooltipItems,
  hasDisplayableActionLog,
} from '../crud-action-log-tooltip';

describe('crud action log tooltip', () => {
  it('does not show tooltip for empty or non-displayable action logs', () => {
    expect(hasDisplayableActionLog(undefined)).toBe(false);
    expect(hasDisplayableActionLog(null)).toBe(false);
    expect(hasDisplayableActionLog('')).toBe(false);
    expect(hasDisplayableActionLog([])).toBe(false);
    expect(hasDisplayableActionLog('[{}]')).toBe(false);
    expect(hasDisplayableActionLog('[]')).toBe(false);
    expect(hasDisplayableActionLog('{bad json')).toBe(false);
  });

  it('formats action log arrays into labeled tooltip rows', () => {
    const items = buildActionLogTooltipItems([
      {
        action: '提交审核',
        afterStatus: '待审核',
        beforeStatus: '草稿',
        occurTime: '2026-05-22 12:30:00',
        operator: 'u1-张三',
        remark: '页面提交',
      },
    ]);

    expect(items).toEqual([
      {
        key: '0',
        rows: [
          { label: '发生时间', value: '2026-05-22 12:30:00' },
          { label: '操作人', value: 'u1-张三' },
          { label: '动作前状态', value: '草稿' },
          { label: '动作', value: '提交审核' },
          { label: '动作后状态', value: '待审核' },
          { label: '备注', value: '页面提交' },
        ],
      },
    ]);
  });

  it('parses JSON string action logs and filters empty entries', () => {
    const actionLog = JSON.stringify([
      {},
      {
        action: '审核拒绝',
        extInfo: { requestId: 'abc' },
        operator: 'admin',
      },
    ]);
    const items = buildActionLogTooltipItems(actionLog);

    expect(hasDisplayableActionLog(actionLog)).toBe(true);
    expect(items).toEqual([
      {
        key: '1',
        rows: [
          { label: '操作人', value: 'admin' },
          { label: '动作', value: '审核拒绝' },
          { label: '扩展信息', value: '{"requestId":"abc"}' },
        ],
      },
    ]);
  });
});
