/** 菜单固定查询条件只用于列表请求，不属于权限控制。 */
export type MenuFixedQueryScalar = boolean | null | number | string;
export type MenuFixedQuery = Record<
  string,
  MenuFixedQueryScalar | MenuFixedQueryScalar[]
>;

const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);

function isScalar(value: unknown): value is MenuFixedQueryScalar {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/** 验证并复制配置；非法条件必须阻断，不能降级为无过滤查询。 */
export function parseMenuFixedQuery(value: unknown): MenuFixedQuery {
  if (value === undefined || value === null) return {};
  const parsed = value;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(parsed))
  ) {
    throw new Error('菜单固定查询条件必须是 JSON 对象');
  }
  const result: MenuFixedQuery = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (
      !key.trim() ||
      key.split(/[.[\]]/).some((part) => forbiddenKeys.has(part))
    ) {
      throw new Error(`菜单固定查询条件包含不允许的参数名：${key}`);
    }
    if (
      !isScalar(entry) &&
      !(Array.isArray(entry) && entry.every((value) => isScalar(value)))
    ) {
      throw new Error(`固定条件“${key}”只支持文本、数字、布尔值及其数组`);
    }
    result[key] = Array.isArray(entry) ? [...entry] : entry;
  }
  return result;
}

/** 最后合并固定条件，复制数组防止请求层改变菜单基准。 */
export function mergeFixedQuery(
  query: Record<string, unknown>,
  fixedQuery: MenuFixedQuery,
): Record<string, unknown> {
  return { ...query, ...parseMenuFixedQuery(fixedQuery) };
}

/** 范围或级联字段可传入其全部实际提交参数名。 */
export function isFixedQueryField(
  fieldKeys: string | string[],
  fixedQuery: MenuFixedQuery,
): boolean {
  return (Array.isArray(fieldKeys) ? fieldKeys : [fieldKeys]).some((key) =>
    Object.hasOwn(fixedQuery, key),
  );
}
