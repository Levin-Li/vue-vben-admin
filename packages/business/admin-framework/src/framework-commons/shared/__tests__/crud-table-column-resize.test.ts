import { describe, expect, it } from 'vitest';

import { resizeTemporaryTableColumns } from '../crud-table-column-resize';

describe('公共 CRUD 临时列宽拖动', () => {
  it('按右侧列可缩空间的比例分摊目标列增量', () => {
    const widths = resizeTemporaryTableColumns(
      [120, 180, 300],
      [80, 100, 150],
      [400, 400, 400],
      0,
      240,
    );

    expect(widths[0]).toBe(240);
    expect(widths[1]).toBeCloseTo(138.26, 1);
    expect(widths[2]).toBeCloseTo(221.74, 1);
    expect(widths.reduce((total, width) => total + width, 0)).toBeCloseTo(600);
  });

  it('右侧空间不足时停在最小列宽边界', () => {
    expect(
      resizeTemporaryTableColumns(
        [120, 180, 300],
        [80, 100, 150],
        [1000, 1000, 1000],
        0,
        900,
      ),
    ).toEqual([350, 100, 150]);
  });

  it('向左拖动时右侧列扩展，同时遵守最大列宽', () => {
    const widths = resizeTemporaryTableColumns(
      [240, 140, 220],
      [80, 100, 150],
      [400, 160, 300],
      0,
      100,
    );

    expect(widths[0]).toBeCloseTo(140);
    expect(widths[1]).toBeCloseTo(160);
    expect(widths[2]).toBeCloseTo(300);
    expect(widths[2]).toBeLessThanOrEqual(300);
    expect(widths.reduce((total, width) => total + width, 0)).toBeCloseTo(600);
  });

  it('最后一列和不存在的列不改变宽度', () => {
    const widths = [120, 180, 300];
    expect(
      resizeTemporaryTableColumns(widths, [80, 100, 150], [], 2, 360),
    ).toEqual(widths);
    expect(
      resizeTemporaryTableColumns(widths, [80, 100, 150], [], -1, 360),
    ).toEqual(widths);
  });
});
