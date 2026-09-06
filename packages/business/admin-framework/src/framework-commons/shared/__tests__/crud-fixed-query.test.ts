import { describe, expect, it } from 'vitest';

import { mergeFixedQuery } from '../../menu-fixed-query';
import { isFixedCrudQueryField } from '../crud-fixed-query';
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
});
