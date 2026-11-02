import type { CrudFieldConfig } from '../types';

import { describe, expect, it } from 'vitest';

import {
  canMutateCrudRecord,
  hasRenderedEditableSearchControl,
  isEditableCrudFieldVisible,
  resolveEditableCrudFields,
  shouldApplyEditableSearchDefault,
} from '../crud-editable-access';

const editableField: CrudFieldConfig = {
  key: 'editable',
  label: '是否可编辑',
  type: 'switch',
};

describe('cRUD editable access', () => {
  it('enables editable metadata in all four standard CRUD views', () => {
    const fields = resolveEditableCrudFields([
      { key: 'name', label: '名称' },
      { ...editableField, form: false, search: false, table: false },
    ]);
    expect(fields[0]).toEqual({ key: 'name', label: '名称' });
    expect(fields[1]).toMatchObject({
      allowInput: true,
      form: true,
      formCreate: true,
      formEdit: true,
      search: true,
      table: true,
    });
    expect(resolveEditableCrudFields([{ key: 'name', label: '名称' }])).toEqual(
      [{ key: 'name', label: '名称' }],
    );
  });

  it('shows editable metadata only to super admins', () => {
    expect(isEditableCrudFieldVisible(editableField, { sa: true })).toBe(true);
    expect(isEditableCrudFieldVisible(editableField, {})).toBe(false);
    expect(isEditableCrudFieldVisible({ key: 'name' }, {})).toBe(true);
  });

  it('defaults editable only when the rendered query controls include it', () => {
    const renderedItems = [{ field: editableField, kind: 'field' as const }];

    expect(hasRenderedEditableSearchControl(renderedItems)).toBe(true);
    expect(shouldApplyEditableSearchDefault(false, renderedItems)).toBe(true);
    expect(shouldApplyEditableSearchDefault(true, renderedItems)).toBe(false);
  });

  it('does not default editable from a non-rendered query field', () => {
    expect(
      shouldApplyEditableSearchDefault(false, [
        { kind: 'range', key: 'createTimeRange' },
      ]),
    ).toBe(false);
    expect(
      shouldApplyEditableSearchDefault(false, [
        { field: { key: 'name' }, kind: 'field' },
      ]),
    ).toBe(false);
  });

  it('保留能力元数据的严格检查及无只读标志记录的原有行为', () => {
    expect(canMutateCrudRecord([], { id: 'record-1' }, {})).toBe(true);
    expect(canMutateCrudRecord([editableField], { editable: false }, {})).toBe(
      false,
    );
    expect(canMutateCrudRecord([editableField], { editable: true }, {})).toBe(
      true,
    );
    expect(
      canMutateCrudRecord([editableField], { editable: false }, { sa: true }),
    ).toBe(true);
  });
  it('实际记录的 editable=false 不因页面缺少字段元数据而失效', () => {
    expect(canMutateCrudRecord([], { editable: false }, {})).toBe(false);
    expect(canMutateCrudRecord([], { editable: true }, {})).toBe(true);
    expect(canMutateCrudRecord([], { id: 'record-1' }, {})).toBe(true);
  });

  it.each([{ admin: true }, { tenantAdmin: true }, { platformAdmin: true }])(
    '普通管理员身份不能编辑显式只读记录：%j',
    (userInfo) => {
      expect(canMutateCrudRecord([], { editable: false }, userInfo)).toBe(
        false,
      );
    },
  );

  it.each([
    { superAdmin: true },
    { isSuperAdmin: true },
    { topSuperAdmin: true },
    { isTopSuperAdmin: true },
  ])('超级管理员保留显式只读记录的编辑例外：%j', (userInfo) => {
    expect(canMutateCrudRecord([], { editable: false }, userInfo)).toBe(true);
    expect(
      canMutateCrudRecord([editableField], { editable: false }, userInfo),
    ).toBe(true);
  });
});
