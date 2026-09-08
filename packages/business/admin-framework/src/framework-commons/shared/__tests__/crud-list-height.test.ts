import { describe, expect, it } from 'vitest';

import { getCrudListScroll, resolveCrudListHeight } from '../crud-list-height';

describe('当前分页完整显示布局', () => {
  it('默认由表格承接纵向滚动并保留横向滚动', () => {
    expect(resolveCrudListHeight(undefined)).toEqual({
      showAllPageRows: false,
      pageScrollable: false,
    });
    expect(getCrudListScroll(false, 500)).toEqual({ x: 'max-content', y: 500 });
    expect(getCrudListScroll(false, -20).y).toBe(160);
  });
  it('开启后取消纵向高度约束，由页面滚动', () => {
    expect(resolveCrudListHeight({ showAllPageRows: true })).toEqual({
      showAllPageRows: true,
      pageScrollable: true,
    });
    for (const height of [0, 160, 800, Number.NaN]) {
      expect(getCrudListScroll(true, height)).toEqual({ x: 'max-content' });
    }
  });
  it('全屏继续完整展示分页行，但底层页面不滚动', () => {
    expect(resolveCrudListHeight({ showAllPageRows: true }, true)).toEqual({
      showAllPageRows: true,
      pageScrollable: false,
    });
  });
  it('关闭后恢复有限高度', () => {
    expect(getCrudListScroll(false, Number.NaN)).toEqual({
      x: 'max-content',
      y: 160,
    });
    expect(getCrudListScroll(false, 320).y).toBe(320);
  });
});
