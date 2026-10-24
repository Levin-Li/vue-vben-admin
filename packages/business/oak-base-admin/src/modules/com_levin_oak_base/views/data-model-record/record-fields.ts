import type { CrudFieldConfig } from '@levin/admin-framework/framework-commons/shared/types';

import type {
  DataModelField,
  DataModelFieldType,
  DataModelOperationParameter,
  DataModelRecordScope,
} from '../../api/data-model-service';

// 金额、精确小数和大整数都走文本输入，不能通过 JS Number 转换。
export function toCrudField(field: DataModelField): CrudFieldConfig {
  const fieldTypes: Record<string, CrudFieldConfig['type']> = {
    BOOLEAN: 'switch',
    DATE: 'date',
    DATETIME: 'datetime',
    JSON: 'json',
    TEXT: 'textarea',
    TIME: 'time',
  };
  const type =
    field.options?.length || field.optionSource === 'FIXED'
      ? 'select'
      : fieldTypes[field.type] || 'text';
  return {
    key: field.name,
    label: field.title || field.name,
    help: field.description,
    type,
    required: !field.nullable,
    maxLength: field.type === 'STRING' ? field.length : undefined,
    options: field.options,
    moneyDisplay:
      field.type === 'MONEY' ? { money: true, grouping: 'four' } : undefined,
    table: true,
  };
}

// 公共 JsonSchemaRuntimeForm 解释字段布局和固定选项。高精度值强制为字符串。
export function toRecordSchema(
  fields: DataModelField[],
): Record<string, unknown> {
  const required: string[] = [];
  const properties = Object.fromEntries(
    fields.map((field) => {
      if (!field.nullable) required.push(field.name);
      let type = 'string';
      switch (field.type) {
        case 'BOOLEAN': {
          type = 'boolean';
          break;
        }
        case 'INTEGER': {
          type = 'integer';
          break;
        }
        case 'JSON': {
          type = 'object';
          break;
        }
        default: {
          break;
        }
      }
      return [
        field.name,
        {
          type,
          title: field.title,
          description: field.description,
          ...(field.type === 'TEXT' ? { format: 'textarea' } : {}),
          ...(field.type === 'STRING' &&
          typeof field.length === 'number' &&
          field.length > 0
            ? { maxLength: field.length }
            : {}),
          ...(field.options?.length
            ? {
                enum: field.options.map((option) => option.value),
                enumNames: field.options.map((option) => option.label),
              }
            : {}),
        },
      ];
    }),
  );
  return { type: 'object', properties, required };
}

export function toDatetimeLocal(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 23);
}

// 未改动的时间直接回传服务端原值，保留 PostgreSQL 微秒与时区表示。
export function serializeRecordValue(
  field: DataModelField,
  value: unknown,
  original?: unknown,
): unknown {
  if (field.type !== 'DATETIME' || !value) return value;
  if (original && value === toDatetimeLocal(original)) return original;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime()))
    throw new Error(`${field.title}日期时间无效`);
  return date.toISOString();
}

// 默认值按模型类型初始化；高精度金额、整数保持文本。
export function recordDefaultValues(
  fields: DataModelField[],
): Record<string, unknown> {
  return Object.fromEntries(
    fields
      .filter(
        (field) =>
          field.defaultValue !== undefined && field.defaultValue !== null,
      )
      .map((field) => {
        const value = field.defaultValue;
        let typed: unknown = value;
        if (field.type === 'BOOLEAN')
          typed = value === true || value === 'true';
        else if (field.type === 'INTEGER') typed = Number(value);
        else if (field.type === 'JSON' && typeof value === 'string')
          typed = JSON.parse(value);
        else if (field.type === 'DATETIME') typed = toDatetimeLocal(value);
        else if (field.type !== 'JSON') typed = String(value);
        return [field.name, typed];
      }),
  );
}

// 有类型匹配避免布尔值、字符串编码与数值编码互相混淆。
export function recordDisplayValue(
  field: DataModelField | undefined,
  value: unknown,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const option = field?.options?.find(
    (item) => typeof item.value === typeof value && item.value === value,
  );
  if (option) return option.label;
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

export function recordExpectedVersion(record: Record<string, unknown>): number {
  const value = record.optimisticLock;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    throw new Error('记录缺少有效版本，请刷新记录后重试');
  return value;
}

export interface RuntimeFormField extends DataModelField {
  defaultVisible?: boolean;
  readOnly?: boolean;
  referenceType?: DataModelOperationParameter['referenceType'];
  serverManaged?: boolean;
  source?: string;
}

// 接口字段决定可填写上限；模型信息仅补充长度、精度等字段语义。
export function operationFormFields(
  parameters: DataModelOperationParameter[],
  business: DataModelField[],
  scope: DataModelRecordScope = {},
): RuntimeFormField[] {
  return parameters
    .filter(
      (parameter) =>
        parameter.source === 'SCOPE' ||
        (!parameter.serverManaged &&
          !parameter.readOnly &&
          parameter.source === 'BUSINESS'),
    )
    .map((parameter) => {
      const definition = business.find(
        (field) => field.name === parameter.name,
      );
      let defaultValue =
        parameter.defaultValue === undefined
          ? definition?.defaultValue
          : parameter.defaultValue;
      if (parameter.source === 'SCOPE' && Object.hasOwn(scope, parameter.name))
        defaultValue = scope[parameter.name as keyof DataModelRecordScope];
      return {
        ...definition,
        key: parameter.name,
        name: parameter.name,
        title: parameter.title,
        description: parameter.description,
        type: parameter.type as DataModelFieldType,
        nullable: parameter.nullable !== false,
        defaultValue: defaultValue as DataModelField['defaultValue'],
        options: parameter.options,
        source: parameter.source,
        referenceType: parameter.referenceType,
        readOnly: Boolean(parameter.readOnly || parameter.serverManaged),
        serverManaged: parameter.serverManaged,
        defaultVisible: scopeFieldDefaultVisible(parameter),
      };
    });
}

// 归属存在性与展示分离；平台领域及租户默认隐藏，显式UI设置可覆盖。
export function scopeFieldDefaultVisible(
  field: Pick<
    DataModelOperationParameter,
    'defaultVisible' | 'referenceType' | 'source'
  >,
): boolean {
  if (
    field.source === 'SCOPE' &&
    (field.referenceType === 'TENANT' || field.referenceType === 'DOMAIN')
  )
    return false;
  return field.defaultVisible !== false;
}

// 隐藏不清空默认值，只提交接口当前允许写入且实际存在的scope项。
export function recordScopeValues(
  fields: RuntimeFormField[],
  values: DataModelRecordScope,
): DataModelRecordScope {
  return Object.fromEntries(
    fields
      .filter(
        (field) =>
          field.source === 'SCOPE' &&
          !field.readOnly &&
          !field.serverManaged &&
          Object.hasOwn(values, field.name) &&
          values[field.name as keyof DataModelRecordScope] !== undefined,
      )
      .map((field) => [
        field.name,
        values[field.name as keyof DataModelRecordScope],
      ]),
  );
}
