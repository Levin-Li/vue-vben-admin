import { describe, expect, it } from 'vitest';

import { normalizeTemplateVariables } from '../template-variables';

describe('电子合同模板填写项', () => {
  it('固定正文允许空列表，变量逐项提交服务端所需的布尔必填值', () => {
    expect(normalizeTemplateVariables([])).toEqual([]);
    expect(normalizeTemplateVariables(null)).toEqual([]);
    expect(
      normalizeTemplateVariables([{ key: ' buyerName ', title: ' 买方名称 ' }]),
    ).toEqual([{ key: 'buyerName', title: '买方名称', required: false }]);
  });

  it('拒绝非法、重复和缺少显示名称的变量', () => {
    expect(() =>
      normalizeTemplateVariables([{ key: '1buyer', title: '买方' }]),
    ).toThrow('变量名须以英文字母开头');
    expect(() =>
      normalizeTemplateVariables([
        { key: 'buyerName', title: '买方' },
        { key: 'buyerName', title: '买方名称' },
      ]),
    ).toThrow('重复');
    expect(() =>
      normalizeTemplateVariables([{ key: 'buyerName', title: '' }]),
    ).toThrow('填写名称不能为空');
  });
});
