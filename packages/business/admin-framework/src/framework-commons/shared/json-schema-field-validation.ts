import type { JsonSchemaFormField } from './json-schema-form';

function sameJsonValue(left: any, right: any): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object')
    return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) && sameJsonValue(left[key], right[key]),
    )
  );
}

/** 仅校验动态表单当前支持的显式 Schema 约束，不推断业务规则。 */
export function getJsonSchemaFieldError(
  field: JsonSchemaFormField,
  value: any,
): string | undefined {
  if (field.readOnly || field.kind === 'section') return;
  const { label, schema } = field;
  const empty =
    value === undefined ||
    value === null ||
    (typeof value === 'string' && !value.trim());
  if (empty) return field.required ? `请填写${label}` : undefined;

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const type = types.find((item: unknown) => item !== 'null');
  if (type === 'number' || type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return `${label}必须是有限数值`;
    if (type === 'integer' && !Number.isInteger(value))
      return `${label}必须是整数`;
    if (typeof schema.minimum === 'number' && value < schema.minimum)
      return `${label}不能小于${schema.minimum}`;
    if (typeof schema.maximum === 'number' && value > schema.maximum)
      return `${label}不能大于${schema.maximum}`;
    let exclusiveMinimum = schema.exclusiveMinimum;
    let exclusiveMaximum = schema.exclusiveMaximum;
    if (exclusiveMinimum === true) exclusiveMinimum = schema.minimum;
    if (exclusiveMaximum === true) exclusiveMaximum = schema.maximum;
    if (typeof exclusiveMinimum === 'number' && value <= exclusiveMinimum)
      return `${label}必须大于${exclusiveMinimum}`;
    if (typeof exclusiveMaximum === 'number' && value >= exclusiveMaximum)
      return `${label}必须小于${exclusiveMaximum}`;
  }
  if (type === 'string') {
    if (typeof value !== 'string') return `${label}必须是字符串`;
    const length = [...value].length;
    if (typeof schema.minLength === 'number' && length < schema.minLength)
      return `${label}至少需要${schema.minLength}个字符`;
    if (typeof schema.maxLength === 'number' && length > schema.maxLength)
      return `${label}不能超过${schema.maxLength}个字符`;
  }
  if (type === 'boolean' && typeof value !== 'boolean')
    return `${label}必须是布尔值`;
  if (type === 'array' && !Array.isArray(value)) return `${label}必须是数组`;
  if (type === 'object' && (typeof value !== 'object' || Array.isArray(value)))
    return `${label}必须是对象`;
  if (
    Array.isArray(schema.enum) &&
    !schema.enum.some((item: any) => sameJsonValue(item, value))
  )
    return `${label}必须是允许的选项`;
}
