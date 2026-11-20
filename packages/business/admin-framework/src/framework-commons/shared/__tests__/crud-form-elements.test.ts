import { describe, expect, it } from 'vitest';

import {
  createCrudFormElementRegistry,
  externalCrudFormDisplayKey,
  resolveExternalCrudFormDisplayField,
  stringifyCrudDisplaySnapshot,
} from '../crud-form-elements';

describe('页面表单元素目录', () => {
  it('按 formId 与元素 key 合并同一表单字段', () => {
    const registry = createCrudFormElementRegistry();

    registry.register({
      formId: 'crud-query',
      formName: '查询表单',
      key: 'name',
      label: '名称',
      view: 'query',
    });
    registry.register({
      fieldKeys: ['name'],
      formId: 'crud-query',
      formName: '查询表单',
      key: 'name',
      label: '名称条件',
      view: 'query',
    });

    expect(registry.elements).toEqual([
      expect.objectContaining({
        fieldKeys: ['name'],
        key: 'name',
        label: '名称条件',
      }),
    ]);
  });

  it('拒绝缺少稳定标识的扩展表单元素', () => {
    const registry = createCrudFormElementRegistry();

    registry.register({
      formId: '',
      formName: '',
      key: 'custom-filter',
      label: '自定义筛选',
      view: 'query',
    });

    expect(registry.elements).toEqual([]);
  });

  it('不同表单的同名字段拥有独立展示键', () => {
    expect(externalCrudFormDisplayKey('route-a', 'channel')).not.toBe(
      externalCrudFormDisplayKey('route-b', 'channel'),
    );
    expect(externalCrudFormDisplayKey('route:a', 'channel')).not.toBe(
      externalCrudFormDisplayKey('route', 'a:channel'),
    );
    const fields = [
      { key: 'channel', hidden: true },
      { key: externalCrudFormDisplayKey('route-a', 'channel'), hidden: false },
      { key: externalCrudFormDisplayKey('route-b', 'channel'), hidden: true },
    ];
    expect(
      resolveExternalCrudFormDisplayField(fields, 'route-a', 'channel')?.hidden,
    ).toBe(false);
    expect(
      resolveExternalCrudFormDisplayField(fields, 'route-b', 'channel')?.hidden,
    ).toBe(true);
    expect(
      resolveExternalCrudFormDisplayField(fields, 'route-c', 'channel'),
    ).toBeUndefined();
  });

  it('展示配置比较忽略对象键顺序但保留数组排序', () => {
    expect(stringifyCrudDisplaySnapshot({ b: 2, a: { y: 1, x: 2 } }))
      .toBe(stringifyCrudDisplaySnapshot({ a: { x: 2, y: 1 }, b: 2 }));
    expect(stringifyCrudDisplaySnapshot({ fields: ['a', 'b'] }))
      .not.toBe(stringifyCrudDisplaySnapshot({ fields: ['b', 'a'] }));
  });
});
