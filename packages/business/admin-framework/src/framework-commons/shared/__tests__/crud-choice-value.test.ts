import { describe, expect, it } from 'vitest';

import {
  findMatchingCrudChoiceOption,
  normalizeCrudChoiceFormValue,
  normalizeCrudChoiceOptions,
  shouldPreserveUnmatchedCrudChoiceValue,
} from '../crud-choice-value';

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

  it('matches integer record and option values through their string representations', () => {
    expect(
      findMatchingCrudChoiceOption(gradeField, 100, [
        { label: 'A', value: '100' },
      ])?.label,
    ).toBe('A');
    expect(
      findMatchingCrudChoiceOption(gradeField, '100', [
        { label: 'A', value: 100 },
      ])?.label,
    ).toBe('A');
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

  it('uses a numeric enum code as the option value for numeric fields', () => {
    const options = normalizeCrudChoiceOptions({ valueType: 'number' }, [
      { label: '公开', ordinal: 0, value: 'PUBLIC' },
    ]);

    expect(options).toEqual([{ label: '公开', ordinal: 0, value: 0 }]);
    expect(
      normalizeCrudChoiceFormValue(
        { ...gradeField, valueType: 'number' },
        0,
        options,
      ),
    ).toBe(0);
  });

  it('returns a matched option label and leaves unmatched values without a label', () => {
    const options = [
      { label: '公开', value: 0 },
      { label: '内部', value: 1 },
    ];

    expect(findMatchingCrudChoiceOption(gradeField, 0, options)?.label).toBe(
      '公开',
    );
    expect(
      findMatchingCrudChoiceOption(gradeField, 9, options),
    ).toBeUndefined();
  });

  it('matches a numeric record value to an enum code when the option value is its name', () => {
    const options = [{ label: '租户共享', ordinal: 0, value: 'TENANT_SHARED' }];

    expect(findMatchingCrudChoiceOption(gradeField, 0, options)?.label).toBe(
      '租户共享',
    );
  });

  it('matches a numeric string record value to a numeric enum code', () => {
    const options = [{ label: '租户共享', ordinal: 0, value: 0 }];

    expect(findMatchingCrudChoiceOption(gradeField, '0', options)?.label).toBe(
      '租户共享',
    );
    expect(
      findMatchingCrudChoiceOption(
        { ...gradeField, valueType: 'number' },
        '01',
        options,
      ),
    ).toBeUndefined();
  });

  it('preserves an unchanged unmapped edit value for saving', () => {
    const options = [{ label: '公开', value: 0 }];

    expect(
      shouldPreserveUnmatchedCrudChoiceValue(
        gradeField,
        'LEGACY_PRIVATE',
        'LEGACY_PRIVATE',
        options,
      ),
    ).toBe(true);
    expect(
      shouldPreserveUnmatchedCrudChoiceValue(
        gradeField,
        'LEGACY_PRIVATE',
        0,
        options,
      ),
    ).toBe(false);
  });
});
