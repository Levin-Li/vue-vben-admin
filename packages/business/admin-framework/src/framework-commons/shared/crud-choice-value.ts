import type { SelectOption } from '../api';
import type { CrudFieldConfig } from './types';

function isSelectField(field: CrudFieldConfig) {
  return field.type === 'role-select' || field.type === 'select';
}

function normalizeChoiceScalarValue(
  value: unknown,
  stringOptionValues: Set<string>,
) {
  if (typeof value !== 'number') {
    return value;
  }

  const stringValue = String(value);
  return stringOptionValues.has(stringValue) ? stringValue : value;
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

  const stringOptionValues = new Set(
    options
      .map((option) => option.value)
      .filter(
        (optionValue): optionValue is string => typeof optionValue === 'string',
      ),
  );

  if (stringOptionValues.size === 0) {
    return value;
  }

  return Array.isArray(value)
    ? value.map((item) => normalizeChoiceScalarValue(item, stringOptionValues))
    : normalizeChoiceScalarValue(value, stringOptionValues);
}
