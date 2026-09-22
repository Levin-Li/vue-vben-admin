import { describe, expect, it } from 'vitest';

import {
  buildActionLogTooltipItems,
  formatWorkflowStatusLabel,
  hasDisplayableActionLog,
} from '../crud-action-log-tooltip';

describe('crud action log tooltip', () => {
  it('converts raw and decorated flow status enums to Chinese labels', () => {
    expect(formatWorkflowStatusLabel('Published')).toBe('已发布');
    expect(formatWorkflowStatusLabel('AuditPending-待审核')).toBe('待审核');
  });

  it('does not show tooltip for empty or non-displayable action logs', () => {
    expect(hasDisplayableActionLog(undefined)).toBe(false);
    expect(hasDisplayableActionLog(null)).toBe(false);
    expect(hasDisplayableActionLog('')).toBe(false);
    expect(hasDisplayableActionLog([])).toBe(false);
    expect(hasDisplayableActionLog('[{}]')).toBe(false);
    expect(hasDisplayableActionLog('[]')).toBe(false);
    expect(hasDisplayableActionLog('{bad json')).toBe(false);
  });

  it('formats action logs as Chinese status timeline entries and hides blank remarks', () => {
    const items = buildActionLogTooltipItems([
      {
        action: '提交审核',
        afterStatus: 'AuditPending-待审核',
        beforeStatus: 'Draft-草稿',
        occurTime: '2026-05-22 12:30:00',
        operator: 'u1-张三',
        remark: '页面提交',
      },
    ]);

    expect(items).toEqual([
      {
        key: '0',
        occurTime: '2026-05-22 12:30:00',
        operator: 'u1-张三',
        remark: '页面提交',
        transition: '草稿 → [提交审核] → 待审核',
      },
    ]);
  });

  it('sorts JSON action logs by time and omits blank remarks', () => {
    const actionLog = JSON.stringify([
      {},
      {
        action: '审核拒绝',
        afterStatus: 'AuditRejected-审核拒绝',
        beforeStatus: 'AuditPending-待审核',
        occurTime: '2026-05-22 12:31:00',
        operator: 'admin',
        remark: '   ',
      },
      {
        action: '提交审核',
        afterStatus: 'AuditPending-待审核',
        beforeStatus: 'Draft-草稿',
        occurTime: '2026-05-22 12:30:00',
        operator: 'editor',
      },
    ]);
    const items = buildActionLogTooltipItems(actionLog);

    expect(hasDisplayableActionLog(actionLog)).toBe(true);
    expect(items).toEqual([
      {
        key: '2',
        occurTime: '2026-05-22 12:30:00',
        operator: 'editor',
        transition: '草稿 → [提交审核] → 待审核',
      },
      {
        key: '1',
        occurTime: '2026-05-22 12:31:00',
        operator: 'admin',
        transition: '待审核 → [审核拒绝] → 审核拒绝',
      },
    ]);
  });
});
