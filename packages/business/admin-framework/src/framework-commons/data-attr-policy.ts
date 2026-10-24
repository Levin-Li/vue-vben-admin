import { shallowRef } from 'vue';

import { CanceledError } from '@vben/runtime/request';

export const DATA_ATTR_POLICY_PATH =
  '/com.levin.oak.base/V1/api/rbac/apiDataAttrPolicies';
export const DATA_ATTR_POLICY_SNAPSHOT_PATH =
  '/com.levin.oak.base/V1/api/rbac/apiDataAttrPolicySnapshot';
/** API 方法与路径对应开发期声明，授权结论来自既有登录响应。 */
export interface DataAttrTarget {
  contentType?: string;
  method: string;
  path: string;
}
export interface DataAttrField {
  aliases?: string[];
  caseInsensitive?: boolean | null;
  groupIds?: string[];
  name: string;
  nodeId: string;
  wireName: string;
}
export interface DataAttrNode {
  caseInsensitive?: boolean;
  elementNodeId?: string;
  fields?: DataAttrField[];
  kind: 'array' | 'map' | 'object' | 'value';
  locale?: string;
  selectorNodeId?: string;
  valueNodeId?: string;
}
export interface DataAttrPolicy {
  groups: { allowed: boolean; id: string; name: string }[];
  id: string;
  methods: string[];
  nodes: Record<string, DataAttrNode>;
  operation: string;
  pathPatterns: string[];
  requestRoots: {
    location: 'body' | 'parameters';
    nodeId: string;
    parameterIndex: number;
  }[];
  responseRoot?: null | string;
  restricted: boolean;
  viewRoots: { request: string[]; response: string[] };
}
export interface DataAttrPolicies {
  policies: DataAttrPolicy[];
  version: number;
}
export interface DataAttrStaticGroup {
  authorizable: boolean;
  confidentialLevel?: number;
  entityPermission?: null | string;
  id: string;
  name: string;
  permission?: null | string;
}
export interface DataAttrStaticPolicy extends Omit<
  DataAttrPolicy,
  'groups' | 'operation'
> {
  groups: DataAttrStaticGroup[];
  operation: null | string;
}
export interface DataAttrStaticContract {
  policies: DataAttrStaticPolicy[];
  version: number;
}
export interface DataAttrFieldGrants {
  allowed: { groupKeys: string[]; operation: string }[];
  version: number;
}
const staticPolicies = new Map<string, DataAttrStaticPolicy>();
const fieldGrants = new Map<string, Set<string>>();
const missingWarnings = new Set<string>();
let staticMode = false;
type PolicyQuery = DataAttrTarget | { operation: string };
type Loader = (query: PolicyQuery) => Promise<DataAttrPolicies>;
let loader: Loader | undefined;
let snapshot: DataAttrPolicies | undefined;
let snapshotLoading: Promise<void> | undefined;
let snapshotMode = false;
const snapshotTargets = new Map<string, DataAttrPolicy[]>();
let enabled = false;
// 就绪状态与策略加载器同步变化，供启动与退出阶段延后附属业务请求。
const policyReady = shallowRef(false);
let generation = 0;
const listeners = new Set<() => void>();
export function isDataAttrPolicyEnabled() {
  return enabled;
}
export function isDataAttrPolicyReady() {
  return policyReady.value;
}
export function getDataAttrPolicyEpoch() {
  return generation;
}
export function subscribeDataAttrPolicyInvalidation(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const cache = new Map<string, Promise<DataAttrPolicy>>();

/** 切换账号或刷新权限时废弃包括无组结果在内的会话缓存。 */
export function clearDataAttrPolicies() {
  generation++;
  cache.clear();
  fieldGrants.clear();
  missingWarnings.clear();
  snapshot = undefined;
  snapshotLoading = undefined;
  snapshotTargets.clear();
  if (snapshotMode || staticMode) policyReady.value = false;
  listeners.forEach((listener) => listener());
}
export function suspendDataAttrPolicies() {
  loader = undefined;
  policyReady.value = false;
  clearDataAttrPolicies();
}
export function configureDataAttrPolicyLoader(next: Loader) {
  enabled = true;
  staticMode = false;
  snapshotMode = false;
  policyReady.value = false;
  loader = next;
  clearDataAttrPolicies();
  policyReady.value = true;
}

/** 注册开发期生成的 API 契约。声明属于模块，不随账号退出而丢失。 */
export function registerDataAttrStaticContract(
  contract: DataAttrStaticContract,
) {
  if (contract.version !== 1 || !Array.isArray(contract.policies))
    throw new Error('API字段静态契约无效');
  // 先完整校验，再原子注册，避免半份契约进入页面。
  const pending = new Map(staticPolicies);
  const definitions = contract.policies.map((policy) => {
    if (
      !policy.id ||
      (policy.operation !== null && typeof policy.operation !== 'string') ||
      !Array.isArray(policy.groups) ||
      policy.groups.some((group) => typeof group.authorizable !== 'boolean')
    )
      throw new Error('API字段静态契约无效');
    validatePolicy({
      ...policy,
      operation: policy.operation || '',
      groups: policy.groups.map((group) => ({ ...group, allowed: false })),
    });
    policy.pathPatterns.forEach((pattern) => pathSpecificity(pattern, ''));
    const existing = pending.get(policy.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(policy))
      throw new Error(`API字段静态契约标识冲突: ${policy.id}`);
    const copy = structuredClone(policy);
    pending.set(policy.id, copy);
    return copy;
  });
  definitions.forEach((policy) => staticPolicies.set(policy.id, policy));
  enabled = true;
  staticMode = true;
  snapshotMode = false;
  loader = undefined;
  cache.clear();
  listeners.forEach((listener) => listener());
}

/** 只接受既有登录响应中的后端有效授权结论；这里不重新解释角色权限。 */
export function initializeDataAttrFieldGrants(grants: DataAttrFieldGrants) {
  if (
    grants?.version !== 1 ||
    !Array.isArray(grants.allowed) ||
    grants.allowed.some(
      (grant) =>
        typeof grant.operation !== 'string' ||
        !Array.isArray(grant.groupKeys) ||
        grant.groupKeys.some((key) => typeof key !== 'string'),
    )
  )
    throw new Error('登录字段授权数据无效');
  enabled = true;
  staticMode = true;
  snapshotMode = false;
  loader = undefined;
  clearDataAttrPolicies();
  for (const grant of grants.allowed) {
    const keys = fieldGrants.get(grant.operation) || new Set<string>();
    grant.groupKeys.forEach((key) => keys.add(key));
    fieldGrants.set(grant.operation, keys);
  }
  policyReady.value = true;
  listeners.forEach((listener) => listener());
}

function mergeStaticPolicy(policy: DataAttrStaticPolicy): DataAttrPolicy {
  return {
    ...structuredClone(policy),
    operation: policy.operation || '',
    groups: policy.groups.map((group) => ({
      id: group.id,
      name: group.name,
      allowed:
        group.authorizable &&
        policy.operation !== null &&
        !!fieldGrants.get(policy.operation)?.has(group.id),
    })),
  };
}

function pathSpecificity(pattern: string, path: string): number | undefined {
  if (pattern === path) return Number.MAX_SAFE_INTEGER;
  let score = 1_000_000_000;
  let expression = '';
  const escape = (char: string) =>
    char.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index] as string;
    if (char === '{') {
      let depth = 1;
      let end = index + 1;
      for (; end < pattern.length && depth; end++) {
        if (pattern[end] === '\\') {
          end++;
          continue;
        }
        if (pattern[end] === '{') depth++;
        if (pattern[end] === '}') depth--;
      }
      if (depth) throw new Error(`API字段静态契约路径无效: ${pattern}`);
      const variable = pattern.slice(index + 1, end - 1);
      if (variable.startsWith('*')) {
        score -= 2_000_000_000;
        expression += '.*';
      } else {
        score -= 10_000;
        const colon = variable.indexOf(':');
        expression +=
          colon === -1 ? '[^/]+' : `(?:${variable.slice(colon + 1)})`;
      }
      index = end - 1;
    } else if (char === '*' && pattern[index + 1] === '*') {
      score -= 2_000_000_000;
      expression += '.*';
      index++;
    } else if (char === '*' || char === '?') {
      score -= 1_000_000;
      expression += char === '*' ? '[^/]*' : '[^/]';
    } else {
      score++;
      expression += escape(char);
    }
  }
  // Spring 尾部 catch-all 同时匹配父路径本身。
  if (pattern.endsWith('/**') || /\/\{\*[^}]+\}$/.test(pattern))
    expression = `${expression.slice(0, -3)}(?:/.*)?`;
  try {
    return new RegExp(`^${expression}$`).test(path) ? score : undefined;
  } catch {
    throw new Error(`API字段静态契约路径无效: ${pattern}`);
  }
}

/** 兼容旧服务入口的纯本地读取；不会调用加载器或任何 HTTP 接口。 */
export function readDataAttrLocalPolicies(
  query?: PolicyQuery,
): DataAttrPolicies {
  if (!policyReady.value || !staticMode)
    throw new CanceledError('字段权限尚未就绪，请完成登录');
  if (query && !('operation' in query))
    query = {
      ...query,
      method: query.method.toUpperCase(),
      path: query.path.split('?')[0] || '',
    };
  const policies = [...staticPolicies.values()];
  if (!query)
    return {
      version: 1,
      policies: policies.map((policy) => mergeStaticPolicy(policy)),
    };
  let matches: DataAttrStaticPolicy[];
  if ('operation' in query)
    matches = policies.filter((policy) => policy.operation === query.operation);
  else {
    let best = -Infinity;
    matches = [];
    for (const policy of policies) {
      if (
        policy.methods.length > 0 &&
        !policy.methods.some(
          (method) =>
            method === '*' ||
            method.toUpperCase() === query.method.toUpperCase(),
        )
      )
        continue;
      for (const pattern of policy.pathPatterns) {
        const score = pathSpecificity(pattern, query.path);
        if (score === undefined || score < best) continue;
        if (score > best) {
          best = score;
          matches = [];
        }
        if (!matches.includes(policy)) matches.push(policy);
      }
    }
  }
  if (
    matches.length > 1 &&
    !matches.every(
      (policy) => policy.restricted === false && policy.groups.length === 0,
    )
  )
    throw new Error('API字段静态契约匹配不唯一');
  if (matches.length > 0)
    return {
      version: 1,
      policies: [mergeStaticPolicy(matches[0] as DataAttrStaticPolicy)],
    };
  const key =
    'operation' in query
      ? query.operation
      : `${query.method.toUpperCase()} ${query.path}`;
  if (!missingWarnings.has(key)) {
    missingWarnings.add(key);
    console.warn(`[字段权限] API 未声明静态字段分组，前端按无限制处理: ${key}`);
  }
  return {
    version: 1,
    policies: [
      {
        id: key,
        operation: 'operation' in query ? query.operation : '',
        methods: 'operation' in query ? [] : [query.method],
        pathPatterns: 'operation' in query ? [] : [query.path],
        restricted: false,
        groups: [],
        nodes: {},
        requestRoots: [],
        viewRoots: { request: [], response: [] },
      },
    ],
  };
}

/** 旧宿主显式注入快照的兼容入口；标准登录流程使用本地契约和字段授权。 */
export function initializeDataAttrPolicySnapshot(
  load: () => Promise<DataAttrPolicies>,
) {
  if (snapshotMode && snapshotLoading) return snapshotLoading;
  enabled = true;
  staticMode = false;
  snapshotMode = true;
  loader = undefined;
  policyReady.value = false;
  clearDataAttrPolicies();
  const epoch = generation;
  snapshotLoading = Promise.resolve()
    .then(load)
    .then((result) => {
      if (epoch !== generation)
        throw new CanceledError('登录身份已变化，已丢弃字段快照');
      if (result.version !== 1 || !Array.isArray(result.policies))
        throw new Error('API字段策略快照无效');
      for (const policy of result.policies) {
        validatePolicy(policy);
        for (const path of policy.pathPatterns) {
          for (const method of policy.methods.length > 0
            ? policy.methods
            : ['*']) {
            const key = `${method.toUpperCase()} ${path}`;
            const matches = snapshotTargets.get(key) || [];
            matches.push(policy);
            snapshotTargets.set(key, matches);
          }
        }
      }
      snapshot = result;
      policyReady.value = true;
      listeners.forEach((listener) => listener());
    });
  return snapshotLoading;
}

/** 仅保留会话就绪检查；实际业务请求的字段安全由后端处理器执行。 */
export function assertDataAttrSessionReady() {
  if (enabled && !policyReady.value)
    throw new CanceledError('登录会话尚未就绪，不能提交业务请求');
}

function fetchPolicy(query: PolicyQuery): Promise<DataAttrPolicy> {
  if (staticMode) {
    const epoch = generation;
    return Promise.resolve().then(() => {
      if (generation !== epoch)
        throw new CanceledError('登录身份或权限已变化，请重新操作');
      return readDataAttrLocalPolicies(query).policies[0] as DataAttrPolicy;
    });
  }

  if (snapshotMode) {
    if (!snapshot || !policyReady.value)
      return Promise.reject(
        new CanceledError('字段权限快照尚未就绪，请刷新页面'),
      );
    const matches =
      'operation' in query
        ? snapshot.policies.filter(
            (policy) => policy.operation === query.operation,
          )
        : [
            ...(snapshotTargets.get(`${query.method} ${query.path}`) || []),
            ...(snapshotTargets.get(`* ${query.path}`) || []),
          ];
    if (matches.length !== 1)
      return Promise.reject(
        new Error(
          matches.length > 0
            ? 'API字段策略快照匹配不唯一'
            : '字段权限快照未包含此接口，请刷新页面',
        ),
      );
    return Promise.resolve(matches[0] as DataAttrPolicy);
  }
  if (!loader) {
    return Promise.reject(
      enabled
        ? new CanceledError('登录会话尚未就绪，不能读取业务策略')
        : new Error('API属性组策略尚未初始化'),
    );
  }
  const key = JSON.stringify(query);
  const present = cache.get(key);
  if (present) return present;
  const epoch = generation;
  const promise = loader(query)
    .then((result) => {
      // 旧会话请求必须终止；使用请求层标准取消类型，避免将正常上下文切换误报服务器故障。
      if (generation !== epoch)
        throw new CanceledError('登录身份或权限已变化，请重新操作');
      if (
        result.version !== 1 ||
        !Array.isArray(result.policies) ||
        result.policies.length !== 1
      ) {
        throw new Error('API属性组策略不明确，请配置实际请求方法和路径');
      }
      const policy = result.policies[0] as DataAttrPolicy;
      if (
        typeof policy.restricted !== 'boolean' ||
        !policy.nodes ||
        !Array.isArray(policy.groups)
      ) {
        throw new Error('API属性组策略无效');
      }
      validatePolicy(policy);
      return policy;
    })
    .catch((error) => {
      if (cache.get(key) === promise) cache.delete(key);
      throw error;
    });
  cache.set(key, promise);
  return promise;
}
export function loadDataAttrPolicy(
  method: string,
  path: string,
  contentType?: string,
) {
  return fetchPolicy({
    method: method.toUpperCase(),
    path: path.split('?')[0] || '',
    ...(contentType ? { contentType } : {}),
  });
}
export async function loadDataAttrPolicyByOperation(
  operation: string,
  target?: DataAttrTarget,
) {
  if (target)
    return loadDataAttrPolicy(target.method, target.path, target.contentType);
  const policy = await fetchPolicy({ operation });
  if (policy.operation !== operation)
    throw new Error('API操作与属性组策略不一致');
  return policy;
}
function tokens(path: string) {
  return path
    .replaceAll(/\[([^\]]+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}
function member(policy: DataAttrPolicy, field: DataAttrField) {
  return (field.groupIds || []).every((id) =>
    policy.groups.some((group) => group.id === id && group.allowed),
  );
}
function candidates(node: DataAttrNode, name: string, insensitive?: boolean) {
  return (node.fields || []).filter((field) =>
    [field.name, field.wireName, ...(field.aliases || [])].some((alias) => {
      if (alias === name) return true;
      if (!(insensitive ?? node.caseInsensitive)) return false;
      return (
        alias.toLowerCase() === name.toLowerCase() ||
        alias.toLocaleLowerCase(node.locale || 'en') ===
          name.toLocaleLowerCase(node.locale || 'en')
      );
    }),
  );
}
export function validatePolicy(policy: DataAttrPolicy) {
  if (
    typeof policy.restricted !== 'boolean' ||
    !policy.nodes ||
    !Array.isArray(policy.groups) ||
    !Array.isArray(policy.methods) ||
    !Array.isArray(policy.pathPatterns) ||
    policy.methods.some((method) => typeof method !== 'string') ||
    policy.pathPatterns.some((path) => typeof path !== 'string') ||
    policy.groups.some(
      (group) => !group.id || typeof group.allowed !== 'boolean',
    )
  )
    throw new Error('API属性组策略无效');
  const exists = (id: unknown) => {
    if (typeof id !== 'string' || !policy.nodes[id])
      throw new Error('API属性组策略节点缺失');
  };
  if (
    !policy.viewRoots ||
    !Array.isArray(policy.viewRoots.request) ||
    !Array.isArray(policy.viewRoots.response) ||
    !Array.isArray(policy.requestRoots)
  )
    throw new Error('API属性组策略根无效');
  const groupIds = new Set(policy.groups.map((group) => group.id));
  for (const root of [
    ...policy.viewRoots.request,
    ...policy.viewRoots.response,
  ])
    exists(root);
  for (const root of policy.requestRoots) {
    if (!['body', 'parameters'].includes(root.location))
      throw new Error('API属性组策略根无效');
    exists(root.nodeId);
  }
  if (policy.responseRoot) exists(policy.responseRoot);
  for (const node of Object.values(policy.nodes)) {
    if (!['array', 'map', 'object', 'value'].includes(node.kind))
      throw new Error('API属性组策略类型无效');
    if (node.kind === 'array') exists(node.elementNodeId);
    if (node.kind === 'map') exists(node.valueNodeId);
    if (node.kind === 'object' && !Array.isArray(node.fields))
      throw new Error('API属性组策略属性无效');
    if (node.selectorNodeId) exists(node.selectorNodeId);
    for (const field of node.fields || []) {
      exists(field.nodeId);
      if (
        !field.name ||
        !field.wireName ||
        (field.groupIds || []).some((id) => !groupIds.has(id))
      )
        throw new Error('API属性组策略属性无效');
    }
  }
}
function allowedAt(
  policy: DataAttrPolicy,
  id: string,
  path: string[],
  insensitive?: boolean,
  visited = new Set<string>(),
): boolean {
  const node = policy.nodes[id];
  if (!node) throw new Error('API属性组策略节点缺失');
  const signature = `${id}:${path.join('.')}`;
  if (visited.has(signature)) return true;
  visited.add(signature);
  if (node.kind === 'array' || node.kind === 'map') {
    const child = node.elementNodeId || node.valueNodeId;
    return (
      !child ||
      allowedAt(
        policy,
        child,
        node.kind === 'map' || /^\d+$/.test(path[0] || '') || path[0] === '*'
          ? path.slice(1)
          : path,
        insensitive,
        visited,
      )
    );
  }
  if (path.length === 0 || node.kind === 'value') return true;
  if (
    path.length > 1 &&
    candidates(node, path.join('.'), insensitive).length > 0
  )
    path = [path.join('.')];
  return candidates(node, path[0] || '', insensitive).every(
    (field) =>
      member(policy, field) &&
      allowedAt(
        policy,
        field.nodeId,
        path.slice(1),
        field.caseInsensitive ?? undefined,
        new Set(visited),
      ),
  );
}
/** 展示按业务视图根定位；所有匹配路径均须通过，避免同名属性放宽。 */
export function fieldAllowed(
  policy: DataAttrPolicy,
  direction: 'input' | 'output',
  path: string,
) {
  if (!policy.restricted) return true;
  const roots =
    direction === 'input'
      ? policy.viewRoots.request
      : policy.viewRoots.response;
  return roots.every((id) => allowedAt(policy, id, tokens(path)));
}
function requireAllowed(policy: DataAttrPolicy, id: string, path: string) {
  if (!allowedAt(policy, id, tokens(path)))
    throw new Error(`请求属性[${path}]未授予属性组权限`);
}
function selectorValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' ? value.split(',') : [];
}
function checkSelector(policy: DataAttrPolicy, id: string, value: unknown) {
  const values = selectorValues(value);
  for (const entry of values) {
    if (typeof entry !== 'string') throw new Error('属性选择参数格式无效');
    if (entry.includes('*')) {
      if (policy.groups.some((group) => !group.allowed))
        throw new Error('无权选择全部属性');
      continue;
    }
    const identifiers = entry.match(/[\p{L}_$][\p{L}\p{N}_$]*/gu) || [];
    for (const name of identifiers) {
      requireAllowed(policy, id, name);
    }
  }
}
function visit(
  policy: DataAttrPolicy,
  id: string,
  value: unknown,
  prune: boolean,
  insensitive?: boolean,
  seen = new WeakSet<object>(),
): any {
  const node = policy.nodes[id];
  if (!node) throw new Error('API属性组策略节点缺失');
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) throw new Error('请求参数不能包含循环引用');
  seen.add(value);
  try {
    if (node.kind === 'array' || node.kind === 'map') {
      const child = node.elementNodeId || node.valueNodeId;
      if (!child) return value;
      return Array.isArray(value)
        ? value.map((item) =>
            visit(policy, child, item, prune, insensitive, seen),
          )
        : Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
              key,
              visit(policy, child, item, prune, insensitive, seen),
            ]),
          );
    }
    if (node.kind !== 'object') return value;
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, item] of Object.entries(value)) {
      const parts =
        candidates(node, key, insensitive).length > 0 ? [key] : tokens(key);
      const fields = candidates(node, parts[0] || '', insensitive);
      const field = fields[0];
      const allowed = allowedAt(policy, id, parts, insensitive);
      if (!allowed) {
        if (prune) continue;
        throw new Error(`请求属性[${key}]未授予属性组权限`);
      }
      const selectorId =
        node.selectorNodeId &&
        ['forceUpdateFields', 'orderBy', 'selectColumns'].includes(
          field?.name || key,
        )
          ? node.selectorNodeId
          : undefined;
      if (selectorId) {
        if (prune && field?.name === 'forceUpdateFields') {
          const fields = selectorValues(item);
          result[key] = fields.filter(
            (path) =>
              typeof path === 'string' &&
              allowedAt(policy, selectorId, tokens(path)),
          );
          continue;
        }
        checkSelector(policy, selectorId, item);
      }
      let current = item;
      for (const candidate of fields) {
        current = visitPath(
          policy,
          candidate.nodeId,
          parts.slice(1),
          current,
          prune,
          candidate.caseInsensitive ?? undefined,
          seen,
        );
      }
      result[key] = current;
    }
    return prune ? result : value;
  } finally {
    seen.delete(value);
  }
}
function visitPath(
  policy: DataAttrPolicy,
  id: string,
  path: string[],
  value: unknown,
  prune: boolean,
  insensitive: boolean | undefined,
  seen: WeakSet<object>,
): any {
  if (path.length === 0)
    return visit(policy, id, value, prune, insensitive, seen);
  const node = policy.nodes[id];
  if (!node) throw new Error('API属性组策略节点缺失');
  if (node.kind === 'array' || node.kind === 'map') {
    const child = node.elementNodeId || node.valueNodeId;
    return child
      ? visitPath(policy, child, path.slice(1), value, prune, insensitive, seen)
      : value;
  }
  let current = value;
  for (const field of candidates(node, path[0] || '', insensitive)) {
    current = visitPath(
      policy,
      field.nodeId,
      path.slice(1),
      current,
      prune,
      field.caseInsensitive ?? undefined,
      seen,
    );
  }
  return current;
}
function requestObject(value: unknown): unknown {
  if (
    value instanceof URLSearchParams ||
    (typeof FormData !== 'undefined' && value instanceof FormData)
  ) {
    const result: Record<string, unknown> = Object.create(null);
    value.forEach((item, key) => {
      result[key] = Object.hasOwn(result, key)
        ? [
            ...(Array.isArray(result[key])
              ? (result[key] as unknown[])
              : [result[key]]),
            item,
          ]
        : item;
    });
    return result;
  }
  return value;
}
export function assertDataAttrInput(policy: DataAttrPolicy, payload: unknown) {
  if (!policy.restricted) return;
  if (Array.isArray(payload)) {
    payload.forEach((item) => assertDataAttrInput(policy, item));
    return;
  }
  policy.viewRoots.request.forEach((id) => visit(policy, id, payload, false));
}
export function pruneDataAttrInput<T>(policy: DataAttrPolicy, payload: T): T {
  if (!policy.restricted) return payload;
  if (Array.isArray(payload))
    return payload.map((item) => pruneDataAttrInput(policy, item)) as T;
  let result = payload;
  for (const id of policy.viewRoots.request)
    result = visit(policy, id, result, true);
  return result;
}
/** 按Axios的baseURL拼接语义还原实际服务端路径，保留查询参数供后续校验。 */
export function dataAttrRequestPath(path: string, baseURL?: string) {
  let combined = path;
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(path) && baseURL) {
    combined = `${baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(combined)) {
    const url = new URL(combined);
    return url.pathname + url.search;
  }
  return combined;
}
/** 策略查询自身失败只向调用者报错，避免失效订阅重新读取而形成403循环。 */
export function shouldInvalidateDataAttrPolicy(error: any): boolean {
  if (error?.response?.status !== 403 && error?.status !== 403) return false;
  const config = error?.config || error?.response?.config || {};
  const path = dataAttrRequestPath(
    String(config.url || ''),
    config.baseURL,
  ).split('?')[0];
  return !(
    String(config.method || 'GET').toUpperCase() === 'POST' &&
    path === DATA_ATTR_POLICY_PATH
  );
}
/** 通用出口只拒绝无权输入；不删除条件、不修改载荷、不重放写请求。 */
export async function guardDataAttrRequest(
  method: string,
  path: string,
  config: Record<string, any> = {},
) {
  if (!loader) {
    if (enabled) throw new CanceledError('登录会话尚未就绪，不能提交业务请求');
    return;
  }
  path = dataAttrRequestPath(path, config.baseURL);
  const contentType =
    config.headers?.['Content-Type'] || config.headers?.['content-type'];
  const policy = await loadDataAttrPolicy(method, path, contentType);
  if (!policy.restricted) return;
  const query = path.includes('?')
    ? Object.fromEntries(new URLSearchParams(path.slice(path.indexOf('?') + 1)))
    : {};
  const parameters: Record<string, unknown> = Object.assign(
    Object.create(null),
    query,
    requestObject(config.params),
  );
  let body = requestObject(config.data);
  if (typeof config.data === 'string') {
    body = String(contentType).includes('x-www-form-urlencoded')
      ? requestObject(new URLSearchParams(config.data))
      : JSON.parse(config.data);
  }
  const isForm =
    config.data instanceof URLSearchParams ||
    (typeof FormData !== 'undefined' && config.data instanceof FormData) ||
    String(contentType).includes('x-www-form-urlencoded');
  if (isForm && body && typeof body === 'object')
    Object.assign(parameters, body);
  for (const root of policy.requestRoots) {
    const input = root.location === 'body' ? body : { ...parameters };
    if (root.location === 'parameters') {
      for (const [name, value] of Object.entries(parameters)) {
        // Spring默认表单marker/default前缀及空数组后缀也会写入真实属性。
        if (name.endsWith('[]'))
          (input as Record<string, unknown>)[name.slice(0, -2)] = value;
        if (name.startsWith('_') || name.startsWith('!')) {
          (input as Record<string, unknown>)[
            name.slice(1).replace(/\[\]$/, '')
          ] = value;
        }
      }
    }
    visit(policy, root.nodeId, input, false);
  }
}

/** 客户端展示防御只裁剪服务端已定义的业务结果字段，不生成新的授权。 */
export function pruneDataAttrOutput<T>(policy: DataAttrPolicy, payload: T): T {
  if (!policy.restricted) return payload;
  const prune = (value: unknown): any => {
    if (Array.isArray(value)) return value.map((item) => prune(item));
    let result = value;
    for (const id of policy.viewRoots.response)
      result = visit(policy, id, result, true);
    return result;
  };
  return prune(payload);
}
