import { describe, expect, it } from 'vitest';

import { normalizeCrudChoiceFormValue } from '../crud-choice-value';

const gradeField = {
  key: 'grade',
  label: '评级',
  type: 'select',
} as const;

const gradeOptions = [
  { label: 'A', value: '100' },
  { label: 'B', value: '200' },
  { label: 'S', value: '300' },
];

describe('crud choice form value', () => {
  it('matches a numeric record value to an equivalent string enum or dict option', () => {
    expect(normalizeCrudChoiceFormValue(gradeField, 100, gradeOptions)).toBe(
      '100',
    );
  });

  it('normalizes every matching value in a multiple select', () => {
    expect(
      normalizeCrudChoiceFormValue(
        { ...gradeField, multiple: true },
        [100, 300],
        gradeOptions,
      ),
    ).toEqual(['100', '300']);
  });

  it('keeps values unchanged when no equivalent string option exists', () => {
    expect(normalizeCrudChoiceFormValue(gradeField, 400, gradeOptions)).toBe(
      400,
    );
    expect(
      normalizeCrudChoiceFormValue(
        { ...gradeField, type: 'number' },
        100,
        gradeOptions,
      ),
    ).toBe(100);
  });
});
