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

  it('applies row mutation restrictions only to CRUDs with editable metadata', () => {
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
});
