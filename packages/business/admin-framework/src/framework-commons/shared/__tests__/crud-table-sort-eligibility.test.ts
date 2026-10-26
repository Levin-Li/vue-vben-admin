import { describe, expect, it } from 'vitest';

import {
  canSortCrudTableField,
  isCrudTableFieldSortable,
} from '../crud-table-sort-eligibility';

const field = (overrides: Record<string, unknown> = {}) => ({
  key: 'amount',
  label: '金额',
  type: 'number' as const,
  ...overrides,
});

describe('公共 CRUD 列表排序资格', () => {
  it('名称、类型、类别、日期时间及枚举字典默认开启', () => {
    for (const [key, label] of [
      ['name', '名称'],
      ['customerName', '客户名称'],
      ['type', '类型'],
      ['businessType', '业务类型'],
      ['category', '类别'],
      ['userCategory', '用户类别'],
    ]) {
      expect(
        isCrudTableFieldSortable(field({ key, label, type: 'text' })),
      ).toBe(true);
    }
    for (const type of ['date', 'datetime', 'time']) {
      expect(isCrudTableFieldSortable(field({ type }))).toBe(true);
    }
    expect(
      isCrudTableFieldSortable(
        field({ key: 'expiresAt', label: '到期时间', type: 'text' }),
      ),
    ).toBe(true);
    for (const optionSource of ['enum', 'dictionary']) {
      expect(
        isCrudTableFieldSortable(
          field({
            type: 'select',
            loadOptions: Object.assign(() => Promise.resolve([]), {
              optionSource,
            }),
          }),
        ),
      ).toBe(true);
    }
    expect(
      isCrudTableFieldSortable(
        field({ type: 'select', options: [{ label: '甲', value: 'A' }] }),
      ),
    ).toBe(true);
  });

  it('其他后端标量字段默认关闭，但展示设置可开启和关闭', () => {
    expect(canSortCrudTableField(field())).toBe(true);
    expect(isCrudTableFieldSortable(field())).toBe(false);
    expect(isCrudTableFieldSortable(field(), true)).toBe(true);
    expect(
      isCrudTableFieldSortable(
        field({ key: 'name', label: '名称', type: 'text' }),
        false,
      ),
    ).toBe(false);
    expect(
      isCrudTableFieldSortable(field({ type: 'select', key: 'ownerId' })),
    ).toBe(false);
    expect(
      isCrudTableFieldSortable(field({ type: 'select', key: 'ownerId' }), true),
    ).toBe(true);
  });

  it('无后端映射的列不能通过展示设置开启', () => {
    for (const overrides of [
      { key: '__tenant' },
      { type: 'json' },
      { type: 'image' },
      { type: 'file' },
      { type: 'tags' },
      { type: 'textarea' },
      { maxLength: 1000 },
      { hasBackingField: false },
      { complexValue: true },
      { tableValue: () => '展示值' },
      { sortable: false },
    ]) {
      expect(canSortCrudTableField(field(overrides))).toBe(false);
      expect(isCrudTableFieldSortable(field(overrides), true)).toBe(false);
    }
  });

  it('特殊展示列使用开发者指定的后端排序字段', () => {
    const mapped = field({ type: 'json', sortField: '_model.sortValue' });
    expect(canSortCrudTableField(mapped)).toBe(true);
    expect(isCrudTableFieldSortable(mapped)).toBe(true);
    expect(isCrudTableFieldSortable(mapped, false)).toBe(false);
    expect(
      canSortCrudTableField(field({ sortField: 'name', sortable: false })),
    ).toBe(false);
  });
});
