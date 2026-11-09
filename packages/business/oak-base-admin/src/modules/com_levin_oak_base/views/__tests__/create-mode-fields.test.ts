import { describe, expect, it } from 'vitest';

import { createModeFields } from '../create-mode-fields';

describe('普通新增与新增我的参与方字段', () => {
  const fields = [
    { key: 'subjectOrgId' },
    { key: 'subjectUserId' },
    { key: 'businessOrgId' },
    { key: 'businessUserId' },
    { key: 'presalesOrgId' },
    { key: 'parentOrgId' },
    { key: 'name' },
  ].map((field) => ({ ...field, label: field.key }));

  it('普通新增只开放商务组织和商务对接人', () => {
    const result = createModeFields(fields, false);
    expect(
      result
        .filter((field) => field.formCreate !== false)
        .map((field) => field.key),
    ).toEqual(['businessOrgId', 'businessUserId', 'name']);
    expect(
      result.find((field) => field.key === 'businessOrgId')?.required,
    ).toBe(true);
  });

  it('新增我的不提交客户端参与方或外部组织父级', () => {
    const result = createModeFields(fields, true);
    expect(
      result
        .filter((field) => field.formCreate !== false)
        .map((field) => field.key),
    ).toEqual(['name']);
  });
});
