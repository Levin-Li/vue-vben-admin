import { describe, expect, it } from 'vitest';

import { resolveCrudBriefFill } from '../crud-brief-fill';

describe('标准 CRUD 简要表单字段', () => {
  const fields = [
    { key: 'name', label: '名称', required: true },
    { key: 'code', label: '编码' },
    { key: 'category', label: '类别' },
    { key: 'remark', label: '备注' },
  ];

  it('页面指定可选字段时仍带上必填字段并保持相对顺序', () => {
    const result = resolveCrudBriefFill(fields, ['category', 'remark']);
    expect(result.eligible).toBe(true);
    expect(result.orderedFields.map((field) => field.key)).toEqual([
      'name',
      'category',
      'remark',
      'code',
    ]);
  });

  it('页面未声明或字段已被上游权限过滤时不启用简要表单', () => {
    expect(resolveCrudBriefFill(fields, []).eligible).toBe(false);
    expect(
      resolveCrudBriefFill(fields.slice(0, 2), ['category']).eligible,
    ).toBe(false);
    expect(
      resolveCrudBriefFill(
        fields.slice(0, 3),
        ['name', 'category'],
        ['name', 'loginName'],
      ).eligible,
    ).toBe(false);
  });
});
