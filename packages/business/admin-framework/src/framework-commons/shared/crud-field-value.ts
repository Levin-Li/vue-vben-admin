import type { CrudFieldConfig } from './types';

function serializeCrudScalarValue(field: CrudFieldConfig, value: any) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (field.valueType === 'number' || field.type === 'number') {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      throw new TypeError(`${field.label}的值[${value}]不是有效数字`);
    }

    return numberValue;
  }

  if (field.valueType === 'string') {
    return String(value);
  }

  if (field.valueType === 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }

    if (String(value).toLowerCase() === 'true') {
      return true;
    }

    if (String(value).toLowerCase() === 'false') {
      return false;
    }
  }

  return value;
}

export function serializeCrudFieldValue(field: CrudFieldConfig, value: any) {
  if (Array.isArray(value)) {
    return value.map((item) => serializeCrudScalarValue(field, item));
  }

  return serializeCrudScalarValue(field, value);
}
