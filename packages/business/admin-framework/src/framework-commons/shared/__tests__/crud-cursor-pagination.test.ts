import { describe, expect, it } from 'vitest';

import {
  acceptCrudCursor,
  createCrudCursorState,
  moveCrudCursor,
  prepareCrudCursor,
} from '../crud-cursor-pagination';

// 验证服务端游标、条件变化与跨列表隔离。
describe('标准 CRUD 游标分页状态', () => {
  it('没有有效的下一页游标时不能前进，支持返回已经访问的页', () => {
    const state = createCrudCursorState();
    prepareCrudCursor(state, { keyword: '合同' });
    acceptCrudCursor(state, { hasMore: true });
    expect(moveCrudCursor(state, 'next')).toBe(false);
    acceptCrudCursor(state, { hasMore: true, nextCursor: 'opaque:20' });
    expect(moveCrudCursor(state, 'next')).toBe(true);
    expect(prepareCrudCursor(state, { keyword: '合同', size: 20 })).toBe(
      'opaque:20',
    );
    acceptCrudCursor(state, { hasMore: true, nextCursor: 'opaque:20' });
    expect(moveCrudCursor(state, 'next')).toBe(false);
    expect(moveCrudCursor(state, 'previous')).toBe(true);
    expect(state.index).toBe(0);
    expect(moveCrudCursor(state, 'previous')).toBe(false);
  });
  it('筛选和范围变化回首游标，分页参数和其它列表不影响当前状态', () => {
    const state = createCrudCursorState();
    prepareCrudCursor(state, { orgId: 'A', pageIndex: 1 });
    acceptCrudCursor(state, { hasMore: true, nextCursor: 'A:next' });
    moveCrudCursor(state, 'next');
    expect(
      prepareCrudCursor(state, { orgId: 'A', pageIndex: 2, size: 20 }),
    ).toBe('A:next');
    expect(
      prepareCrudCursor(createCrudCursorState(), { orgId: 'A' }),
    ).toBeUndefined();
    expect(prepareCrudCursor(state, { orgId: 'B' })).toBeUndefined();
    expect(state.index).toBe(0);
    expect(state.hasMore).toBe(false);
  });
});
