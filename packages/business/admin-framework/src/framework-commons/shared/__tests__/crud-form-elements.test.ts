import { describe, expect, it } from 'vitest';

import { createCrudFormElementRegistry } from '../crud-form-elements';

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
      expect.objectContaining({ fieldKeys: ['name'], key: 'name', label: '名称条件' }),
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
});
