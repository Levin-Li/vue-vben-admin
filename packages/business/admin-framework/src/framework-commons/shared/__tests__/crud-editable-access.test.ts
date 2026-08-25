import { describe, expect, it } from 'vitest';

import {
  canMutateCrudRecord,
  hasRenderedEditableSearchControl,
  shouldApplyEditableSearchDefault,
} from '../crud-editable-access';
import type { CrudFieldConfig } from '../types';

const editableField: CrudFieldConfig = {
  key: 'editable',
  label: '是否可编辑',
  type: 'switch',
};

describe('CRUD editable access', () => {
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
