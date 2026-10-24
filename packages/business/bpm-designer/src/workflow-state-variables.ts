import type {
  WorkflowCondition,
  WorkflowValueType,
  WorkflowVariable,
} from './types';

function compareNames(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

const reserved = new Set([
  '__proto__',
  'authenticatedUserId',
  'constructor',
  'execution',
  'loopCounter',
  'nrOfActiveInstances',
  'nrOfCompletedInstances',
  'nrOfInstances',
  'prototype',
  'task',
]);
export function isStateVariableAlias(value: string) {
  return (
    /^[A-Z_]\w{0,63}$/i.test(value) &&
    !value.toLowerCase().startsWith('workflow') &&
    !reserved.has(value)
  );
}

/** 字段仍完整开放，只把技术别名与引擎控制空间分开；普通既有别名保持原样。 */
export function buildStateVariables(
  fields: readonly { key: string; type: string }[],
  existing: Record<string, WorkflowVariable> = {},
) {
  const variables: Record<string, WorkflowVariable> = Object.create(null);
  const renamedAliases: Record<string, string> = Object.create(null);
  const occupied = new Set<string>();
  const protectedNames = new Set(
    [...fields.map((field) => field.key), ...Object.keys(existing)].filter(
      (name) => isStateVariableAlias(name),
    ),
  );
  const sources = new Set<string>();
  const allocate = (name: string) => {
    const base = `business_${name.replaceAll(/\W/g, '_')}`.slice(0, 64);
    let alias = base;
    let index = 2;
    while (occupied.has(alias) || protectedNames.has(alias)) {
      const suffix = `_${index++}`;
      alias = `${base.slice(0, 64 - suffix.length)}${suffix}`;
    }
    occupied.add(alias);
    return alias;
  };
  for (const [alias, variable] of Object.entries(existing))
    if (isStateVariableAlias(alias)) {
      variables[alias] = { ...variable };
      occupied.add(alias);
      sources.add(variable.source);
    }
  for (const [alias, variable] of Object.entries(existing).toSorted(
    ([a], [b]) => compareNames(a, b),
  ))
    if (!isStateVariableAlias(alias)) {
      const safe = allocate(alias);
      variables[safe] = { ...variable };
      renamedAliases[alias] = safe;
      sources.add(variable.source);
    }
  const defaults = new Map<
    string,
    { alias: string; variable: WorkflowVariable }
  >();
  // 分配顺序仅用于碰撞消解，最终候选仍按业务目录的字段顺序呈现。
  for (const field of [...fields].toSorted((a, b) =>
    compareNames(a.key, b.key),
  )) {
    const source = `business.${field.key}`;
    if (sources.has(source)) continue;
    const alias =
      isStateVariableAlias(field.key) && !occupied.has(field.key)
        ? field.key
        : allocate(field.key);
    occupied.add(alias);
    sources.add(source);
    defaults.set(field.key, {
      alias,
      variable: {
        source,
        type: field.type as WorkflowValueType,
        readAt: 'node',
      },
    });
  }
  for (const field of fields) {
    const value = defaults.get(field.key);
    if (value) variables[value.alias] = value.variable;
  }
  return { variables, renamedAliases };
}

/** 只重写声明式条件中的变量引用，字面量与业务字段 source 均不改变。 */
export function renameStateCondition(
  condition: undefined | WorkflowCondition,
  renamed: Record<string, string>,
): undefined | WorkflowCondition {
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => visit(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        if (key === 'literal') return [key, child];
        if (key === 'variable' && typeof child === 'string')
          return [key, renamed[child] ?? child];
        return [key, visit(child)];
      }),
    );
  }
  return condition ? (visit(condition) as WorkflowCondition) : undefined;
}
