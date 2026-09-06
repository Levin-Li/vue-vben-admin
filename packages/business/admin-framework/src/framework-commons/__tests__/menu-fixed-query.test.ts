import { describe, expect, it } from 'vitest';
import {
  isFixedQueryField,
  mergeFixedQuery,
  parseMenuFixedQuery,
} from '../menu-fixed-query';

describe('菜单固定参数', () => {
  it('保留 false、0、数组和空值类型', () => {
    expect(
      parseMenuFixedQuery({
        enable: false,
        count: 0,
        ids: [1, 2],
        name: '',
        value: null,
      }),
    ).toEqual({ enable: false, count: 0, ids: [1, 2], name: '', value: null });
  });
  it('固定值最终覆盖且数组修改不影响后续请求', () => {
    const fixed = { enable: false, ids: [1, 2] };
    const result = mergeFixedQuery({ enable: true, page: 2 }, fixed);
    expect(result).toEqual({ enable: false, ids: [1, 2], page: 2 });
    (result.ids as number[]).push(3);
    expect(fixed.ids).toEqual([1, 2]);
  });
  it('范围和级联字段按实际提交键隐藏', () => {
    expect(
      isFixedQueryField(['provinceCode', 'cityCode'], { cityCode: '1' }),
    ).toBe(true);
    expect(isFixedQueryField('enable', { enable: false })).toBe(true);
    expect(isFixedQueryField('name', { enable: false })).toBe(false);
  });
  it.each([
    '',
    '{}',
    '{"enable":true}',
    [],
    { value: { a: 1 } },
    { value: [{}] },
    { constructor: 1 },
    { 'a.__proto__.b': 1 },
  ])('拒绝字符串和非法对象 %s', (value) => {
    expect(() => parseMenuFixedQuery(value)).toThrow();
  });
  it('缺省条件返回空对象', () => {
    expect(parseMenuFixedQuery(null)).toEqual({});
    expect(parseMenuFixedQuery(undefined)).toEqual({});
  });
});
