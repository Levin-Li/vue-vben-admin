import type { SelectOption } from '../api';
import type { CrudFieldConfig } from './types';

function isSelectField(field: CrudFieldConfig) {
  return field.type === 'role-select' || field.type === 'select';
}

export function normalizeCrudChoiceOptions(
  field: Pick<CrudFieldConfig, 'valueType'>,
  options: readonly SelectOption[],
): SelectOption[] {
  if (field.valueType !== 'number') {
    return [...options];
  }

  return options.map((option) =>
    typeof option.ordinal === 'number'
      ? { ...option, value: option.ordinal }
      : option,
  );
}

export function findMatchingCrudChoiceOption(
  _field: Pick<CrudFieldConfig, 'type' | 'valueType'>,
  value: unknown,
  options: readonly SelectOption[],
) {
  const exactMatch = options.find((option) => option.value === value);
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedValue = String(value);

  return options.find((option) => {
    const enumCode = option.ordinal ?? option.code;
    return (
      String(option.value) === normalizedValue ||
      (enumCode !== undefined && String(enumCode) === normalizedValue)
    );
  });
}

function isSameCrudChoiceValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => isSameCrudChoiceValue(item, right[index]))
    );
  }

  return Object.is(left, right);
}

/**
 * Keeps an unmapped edit value intact when the user has not changed it.
 * This avoids coercing a persisted value solely because the current option
 * source no longer contains a matching choice.
 */
export function shouldPreserveUnmatchedCrudChoiceValue(
  field: Pick<CrudFieldConfig, 'type'>,
  originalValue: unknown,
  currentValue: unknown,
  options: readonly SelectOption[],
) {
  return (
    originalValue !== null &&
    originalValue !== undefined &&
    !findMatchingCrudChoiceOption(field, originalValue, options) &&
    isSameCrudChoiceValue(originalValue, currentValue)
  );
}

/**
 * Align numeric record values with equivalent string select option values so
 * strict-equality based select controls can display the saved selection.
 */
export function normalizeCrudChoiceFormValue(
  field: CrudFieldConfig,
  value: unknown,
  options: readonly SelectOption[],
) {
  if (!isSelectField(field)) {
    return value;
  }

  return Array.isArray(value)
    ? value.map(
        (item) =>
          findMatchingCrudChoiceOption(field, item, options)?.value ?? item,
      )
    : (findMatchingCrudChoiceOption(field, value, options)?.value ?? value);
}
