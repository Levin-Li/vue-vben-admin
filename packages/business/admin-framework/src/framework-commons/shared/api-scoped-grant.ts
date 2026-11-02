/** 接口授权附加规则仍保存在原权限列表，不改变普通四段操作权限。 */
export interface ApiScopedGrant {
  groups: string[];
  operation: string;
  values: Record<string, string[]>;
}

const FIELD_NAME = /^[$_\p{ID_Start}][$\p{ID_Continue}]*$/u;

function validToken(value: string) {
  return !!value && value === value.trim() && !/[:@|]/u.test(value);
}

/** 仅解析以 @ 开头的复合授权；其它权限表达式原样交给既有判定。 */
export function parseApiScopedGrant(
  expression: string,
): ApiScopedGrant | undefined {
  if (!expression.startsWith('@')) return undefined;

  const parts = expression.slice(1).split(':');
  if (parts.length !== 5 || !parts[0] || !parts[1] || !parts[3] || !parts[4])
    throw new Error('接口复合授权格式无效');

  const groups: string[] = [];
  const values: Record<string, string[]> = {};
  const clauses = parts[4].split('|');
  for (const [index, clause] of clauses.entries()) {
    if (!clause) throw new Error('接口复合授权包含空规则');
    const tokens = clause.split('@');
    if (clause.startsWith('@')) {
      if (index !== 0 || tokens.length < 2 || groups.length > 0)
        throw new Error('信息组规则位置或内容无效');
      for (const name of tokens.slice(1)) {
        if (!name || name !== name.trim() || groups.includes(name))
          throw new Error('信息组标识重复或无效');
        groups.push(name);
      }
      continue;
    }

    const [sourceField, ...allowed] = tokens;
    const sourceParts = sourceField?.split('#') || [];
    const [kind, source, field] = sourceParts;
    if (
      sourceParts.length !== 3 ||
      (kind !== 'enum' && kind !== 'dict') ||
      !validToken(source) ||
      !FIELD_NAME.test(field) ||
      allowed.length === 0 ||
      values[sourceField]
    )
      throw new Error('字段规则重复或无效');
    if (
      allowed.some((name) => !validToken(name)) ||
      new Set(allowed).size !== allowed.length
    )
      throw new Error('字段允许值重复或无效');
    values[sourceField] = allowed;
  }

  return { operation: parts.slice(0, 4).join(':'), groups, values };
}

/** 按固定顺序生成一条接口复合授权；无附加规则时回到普通操作权限。 */
export function serializeApiScopedGrant(grant: ApiScopedGrant): string {
  const clauses = [
    ...(grant.groups.length > 0
      ? [`@${[...new Set(grant.groups)].join('@')}`]
      : []),
    ...Object.entries(grant.values)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .filter(([, values]) => values.length > 0)
      .map(([field, values]) => `${field}@${[...new Set(values)].join('@')}`),
  ];
  if (clauses.length === 0) return grant.operation;
  return `@${grant.operation}:${clauses.join('|')}`;
}

/** 操作勾选和普通接口鉴权只比较复合授权投影出的四段操作。 */
export function projectOperationPermission(expression: string): string {
  try {
    return parseApiScopedGrant(expression)?.operation || expression;
  } catch {
    return expression;
  }
}

/** 回显同一接口的历史多条授权时合并组和值，编辑后统一保存为一条。 */
export function mergedApiScopedGrant(
  permissions: string[],
  operation: string,
): ApiScopedGrant | undefined {
  let merged: ApiScopedGrant | undefined;
  for (const expression of permissions) {
    let grant: ApiScopedGrant | undefined;
    try {
      grant = parseApiScopedGrant(expression);
    } catch {
      continue;
    }
    if (grant?.operation !== operation) continue;
    merged ||= { operation, groups: [], values: {} };
    for (const group of grant.groups) {
      if (!merged.groups.includes(group)) merged.groups.push(group);
    }
    for (const [field, values] of Object.entries(grant.values)) {
      merged.values[field] = [
        ...new Set([...(merged.values[field] || []), ...values]),
      ];
    }
  }
  return merged;
}

/** 修改某个操作的附加规则时保持其它权限原样，且不会新增第二条同操作权限。 */
export function updateApiScopedGrant(
  permissions: string[],
  operation: string,
  change: (grant: ApiScopedGrant) => ApiScopedGrant,
): string[] {
  const current = mergedApiScopedGrant(permissions, operation);
  const next = serializeApiScopedGrant(
    change(current || { operation, groups: [], values: {} }),
  );
  return [
    ...permissions.filter(
      (expression) =>
        expression !== operation &&
        !(
          expression.startsWith('@') &&
          projectOperationPermission(expression) === operation
        ),
    ),
    next,
  ];
}
