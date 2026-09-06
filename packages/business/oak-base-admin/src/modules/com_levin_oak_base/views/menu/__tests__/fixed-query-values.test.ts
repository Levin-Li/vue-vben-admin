import { buildCrudQueryItems } from '@levin/admin-framework/framework-commons/shared/crud-query-items';
import { describe, expect, it } from 'vitest';

import {
  getFixedQueryAreaControl,
  readFixedQueryValue,
  serializeFixedQueryItems,
} from '../fixed-query-values';
import { copyMenuFormRecord } from '../menu-tree-utils';

describe('菜单固定查询条件', () => {
  const items = buildCrudQueryItems([
    { key: 'success', label: '成功', type: 'switch', valueType: 'boolean' },
    { key: 'count', label: '次数', type: 'number' },
    { key: 'names', label: '名称', type: 'select', multiple: true },
    { key: 'gteTime', label: '时间开始', type: 'datetime' },
    { key: 'lteTime', label: '时间结束', type: 'datetime' },
  ]);
  it('只保存勾选字段，保留 false 和零及数组类型', () => {
    expect(
      serializeFixedQueryItems(items, ['success', 'count', 'names'], {
        success: 'false',
        count: 0,
        names: ['甲', '乙'],
        ignored: '残留',
      }),
    ).toEqual({ success: false, count: 0, names: ['甲', '乙'] });
  });
  it('复用时间范围合并和提交键，并可回填原版本', () => {
    const range = items[3];
    if (!range) throw new Error('缺少时间范围查询项');
    const values = ['2026-09-01T00:00:00', '2026-09-07T00:00:00'];
    const saved = serializeFixedQueryItems(items, [range.key], {
      [range.key]: values,
    });
    expect(saved).toEqual({ gteTime: values[0], lteTime: values[1] });
    expect(readFixedQueryValue(range, saved)).toEqual(values);
  });
  it('勾选后未填值阻止保存，未勾选保留空对象', () => {
    expect(() => serializeFixedQueryItems(items, ['count'], {})).toThrow(
      '请填写次数',
    );
    expect(serializeFixedQueryItems(items, [], { count: 7 })).toEqual({});
  });
  it('复制菜单保留条件与目标页面，不复制标识和子树', () => {
    const source = {
      id: 'old',
      path: '/old',
      name: '成功调用',
      params: { success: true },
      paramsEditor: '{"type":"object"}',
      viewPath: '/page.vue',
      parentId: 'parent',
      optimisticLock: 4,
      children: [{ id: 'child' }],
      requireAuthorizations: ['read'],
    };
    const copy = copyMenuFormRecord(source);
    expect(copy).toMatchObject({
      params: source.params,
      paramsEditor: source.paramsEditor,
      viewPath: source.viewPath,
      parentId: 'parent',
      name: '成功调用（副本）',
    });
    expect(copy.path).toMatch(/^\/menu-entry\//);
    expect(copy.id).toBeUndefined();
    expect(copy.children).toBeUndefined();
    expect(copy.optimisticLock).toBeUndefined();
    copy.requireAuthorizations?.push('extra');
    expect(source.requireAuthorizations).toEqual(['read']);
  });
  it('只允许区县的区域字段拒绝省市并保留区县提交映射', () => {
    const field = {
      key: 'districtCode',
      label: '区域编码',
      type: 'area-cascader' as const,
      areaCascader: {
        selectableLevels: ['district' as const],
        valueKey: 'districtCode',
      },
    };
    const options = [
      {
        value: '44',
        level: 'province',
        children: [
          {
            value: '4401',
            level: 'city',
            children: [{ value: '440106', level: 'district' }],
          },
        ],
      },
    ];
    const control = getFixedQueryAreaControl(field, [], options);
    expect(control.changeOnSelect).toBe(false);
    expect(control.options[0]?.isLeaf).toBe(false);
    expect(control.options[0]?.children[0].isLeaf).toBe(false);
    expect(control.options[0]?.children[0].children[0].isLeaf).toBe(true);
    const areaItems = buildCrudQueryItems([field]);
    for (const value of [['44'], ['44', '4401']]) {
      expect(() =>
        serializeFixedQueryItems(
          areaItems,
          ['districtCode'],
          { districtCode: value },
          { districtCode: options },
        ),
      ).toThrow('请选择指定的行政区划层级');
    }
    expect(
      serializeFixedQueryItems(
        areaItems,
        ['districtCode'],
        { districtCode: ['44', '4401', '440106'] },
        { districtCode: options },
      ),
    ).toMatchObject({ districtCode: '440106' });
  });
});
