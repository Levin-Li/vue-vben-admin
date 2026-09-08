import { describe, expect, it } from 'vitest';

import { mergeFixedQuery } from '../../menu-fixed-query';
import {
  getFixedCrudFormValue,
  isFixedCrudFormField,
  isFixedCrudQueryField,
} from '../crud-fixed-query';
import { omitExcludedCrudFields } from '../crud-submit-fields';

describe('菜单固定查询参数', () => {
  it('false、零及空字符串均使同名字段隐藏', () => {
    for (const value of [false, 0, '']) {
      expect(
        isFixedCrudQueryField(
          { key: 'status', label: '状态' },
          { status: value },
        ),
      ).toBe(true);
    }
    expect(
      isFixedCrudQueryField({ key: 'name', label: '名称' }, { status: false }),
    ).toBe(false);
  });
  it('固定级联实际提交键时隐藏对应控件', () => {
    expect(
      isFixedCrudQueryField(
        { key: 'area', label: '地区', type: 'area-cascader' },
        { cityCode: '1101' },
      ),
    ).toBe(true);
    expect(
      isFixedCrudQueryField(
        {
          key: 'area',
          label: '地区',
          type: 'area-cascader',
          areaCascader: { valueKey: 'areaCode' },
        },
        { areaCode: '110101' },
      ),
    ).toBe(true);
  });
  it('排除表单字段后固定值仍进入分页和导出查询', () => {
    const fixed = { status: false, type: ['a', 'b'] };
    const cleaned = omitExcludedCrudFields(
      { status: true, containsName: '测试' },
      [{ key: 'status', label: '状态' }],
    );
    for (const pageIndex of [1, 2]) {
      expect(
        mergeFixedQuery({ ...cleaned, pageIndex, pageSize: 20 }, fixed),
      ).toEqual({ containsName: '测试', pageIndex, pageSize: 20, ...fixed });
    }
    expect(mergeFixedQuery({}, fixed)).toEqual(fixed);
  });
  it('新增表单仅锁定同名字段，并保留 false 和零的原始类型', () => {
    const field = { key: 'enable', label: '是否启用' };

    expect(isFixedCrudFormField(field, { enable: false })).toBe(true);
    expect(getFixedCrudFormValue(field, { enable: false })).toBe(false);
    expect(getFixedCrudFormValue({ key: 'orderCode', label: '排序' }, { orderCode: 0 })).toBe(0);
    expect(isFixedCrudFormField({ key: 'name', label: '名称' }, { containsName: '固定查询' })).toBe(false);
  });
  it('编辑排除固定字段时同时清理最终载荷和强制更新字段', () => {
    expect(
      omitExcludedCrudFields(
        {
          enable: false,
          forceUpdateFields: ['enable', 'name'],
          name: '保留字段',
        },
        [{ key: 'enable', label: '是否启用' }],
      ),
    ).toEqual({ forceUpdateFields: ['name'], name: '保留字段' });
  });
});
