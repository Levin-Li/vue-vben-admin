import { describe, expect, it } from 'vitest';

import { isLegalSubjectPickerLocked } from '../legal-subject-edit-lock';

describe('法律主体补全控件锁定', () => {
  it('原始记录未关联主体时，表单首次选择后仍可改选', () => {
    const original = { id: 'customer-1', legalSubjectId: null };
    const form = { ...original, legalSubjectId: 'subject-1' };

    expect(form.legalSubjectId).toBe('subject-1');
    expect(isLegalSubjectPickerLocked(false, original)).toBe(false);
  });

  it('原始记录已有主体或其他原因禁用时保持锁定', () => {
    expect(
      isLegalSubjectPickerLocked(false, { legalSubjectId: 'subject-1' }),
    ).toBe(true);
    expect(isLegalSubjectPickerLocked(true, { legalSubjectId: null })).toBe(
      true,
    );
  });
});
