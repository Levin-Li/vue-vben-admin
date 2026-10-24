import { describe, expect, it } from 'vitest';

import { recordFailure } from '../record-errors';

describe('记录错误语义', () => {
  it('兼容普通错误对象与响应message的版本冲突，保留刷新提示', () => {
    for (const error of [
      new Error('版本冲突'),
      { message: '记录版本冲突' },
      { response: { data: { message: 'optimistic conflict' } } },
    ])
      expect(recordFailure(error, '保存失败')).toContain('重新加载');
  });
  it('未知响应不直接展示SQL、堆栈或原始服务信息', () => {
    expect(
      recordFailure(
        {
          message: 'SQL select secret from users',
          response: { data: { detail: 'stack' } },
        },
        '保存失败',
      ),
    ).toBe('保存失败');
    expect(recordFailure('secret raw body', '保存失败')).toBe('保存失败');
  });
});
