import type { DataAttrPolicy } from '../data-attr-policy';
import type { CrudFieldConfig, CrudPageConfig } from './types';

import { onScopeDispose, reactive, watch } from 'vue';

import { buildModuleRequestPath } from '../api';
import {
  getResAuthorizeMeta,
  getServiceMeta,
  hasResAuthorizeMeta,
} from '../api-authorize';
import {
  assertDataAttrInput,
  clearDataAttrPolicies,
  fieldAllowed,
  isDataAttrPolicyEnabled,
  loadDataAttrPolicy,
  loadDataAttrPolicyByOperation,
  pruneDataAttrInput,
  pruneDataAttrOutput,
  subscribeDataAttrPolicyInvalidation,
} from '../data-attr-policy';
import {
  buildApiMethodPermissions,
  buildCrudOperationPermissions,
  resolvePermissionType,
} from './crud-permissions';
import { omitExcludedCrudFields } from './crud-submit-fields';

export type CrudDataAttrOperation =
  | 'batchCreate'
  | 'create'
  | 'delete'
  | 'list'
  | 'retrieve'
  | 'update';

const legacyPolicy: DataAttrPolicy = {
  id: 'legacy-host',
  operation: '',
  methods: [],
  pathPatterns: [],
  restricted: false,
  groups: [],
  nodes: {},
  requestRoots: [],
  viewRoots: { request: [], response: [] },
};

const operations: CrudDataAttrOperation[] = [
  'create',
  'update',
  'list',
  'retrieve',
  'delete',
  'batchCreate',
];

/** 属性策略只服务当前真实可见且获授权的操作，不能因预取隐藏写操作阻断合法列表。 */
export function isCrudDataAttrOperationEnabled(
  config: CrudPageConfig,
  operation: CrudDataAttrOperation,
  hasPermission: (permission: string | string[] | undefined) => boolean,
  visible: (
    action: 'create' | 'delete' | 'edit' | 'retrieve',
  ) => boolean = () => true,
) {
  if (operation === 'batchCreate')
    return (
      typeof config.apiService?.batchCreate === 'function' &&
      hasPermission(buildApiMethodPermissions(config.apiService, operation))
    );
  if (operation === 'list')
    return hasPermission(
      config.queryPermission ||
        buildCrudOperationPermissions(config, operation),
    );
  const action = operation === 'update' ? 'edit' : operation;
  const flag = {
    create: config.allowCreate,
    update: config.allowEdit,
    delete: config.allowDelete,
    retrieve: config.allowRetrieve,
  }[operation];
  const override = {
    create: config.createPermission,
    update: config.editPermission,
    delete: config.deletePermission,
    retrieve: config.detailPermission,
  }[operation];
  const path = {
    create: config.createPath,
    update: config.updatePath,
    delete: config.deletePath,
    retrieve: config.detailPath,
  }[operation];
  const candidates = buildCrudOperationPermissions(config, operation);
  return (
    flag !== false &&
    visible(action) &&
    hasPermission(
      override ||
        (typeof path === 'string' ? [path, ...candidates] : candidates),
    )
  );
}

/** 展示字段可能是复杂对象的扁平别名，权限始终检查真实传输路径。 */
export function resolveCrudDataAttrPath(
  field: CrudFieldConfig,
  config: CrudPageConfig,
) {
  const group = config.complexGroups?.find(
    (item) => item.key === field.complexGroupKey,
  );
  const nested = group?.fieldMappings[field.key];
  return group && nested ? `${group.submitKey}.${nested}` : field.key;
}

/** 只有通用请求分支已明确的路径才可作为实际接口，服务方法别名不得猜测。 */
export function resolveCrudDataAttrTarget(
  config: CrudPageConfig,
  operation: CrudDataAttrOperation,
  listPath: string,
) {
  if (config.dataAttrTargets?.[operation])
    return config.dataAttrTargets[operation];
  let override: CrudPageConfig['createPath'];
  switch (operation) {
    case 'create': {
      override = config.createPath;
      break;
    }
    case 'delete': {
      override = config.deletePath;
      break;
    }
    case 'list': {
      override = config.listPath;
      break;
    }
    case 'retrieve': {
      override = config.detailPath;
      break;
    }
    case 'update': {
      override = config.updatePath;
      break;
    }
  }
  const usesService =
    typeof config.apiService?.[operation] === 'function' &&
    !override &&
    (operation !== 'list' || listPath === `${config.apiBase}/list`);
  if (
    usesService ||
    typeof override === 'function' ||
    operation === 'batchCreate'
  )
    return undefined;
  const path =
    operation === 'list'
      ? listPath
      : override || `${config.apiBase}/${operation}`;
  const methods = {
    create: 'POST',
    update: 'PUT',
    delete: 'DELETE',
    list: 'GET',
    retrieve: 'GET',
    batchCreate: 'POST',
  };
  return {
    method: methods[operation],
    path: buildModuleRequestPath(path as string, config.apiModuleBase),
  };
}

/** 仅登录接口也有稳定操作身份；此处不改变按钮权限的豁免语义。 */
export function resolveCrudDataAttrOperationExpression(
  config: CrudPageConfig,
  operation: CrudDataAttrOperation,
) {
  const method = config.apiService?.[operation] as object | undefined;
  if (!hasResAuthorizeMeta(method)) return undefined;
  const meta = getResAuthorizeMeta(method);
  if (meta.ignored) return undefined;
  if (
    ![meta.domain, meta.type, meta.res, meta.action].some((value) =>
      value.trim(),
    )
  )
    return undefined;
  return [
    meta.domain,
    resolvePermissionType(meta.type, getServiceMeta(config.apiService)),
    meta.res,
    meta.action,
  ].join(':');
}

export function useCrudDataAttrAccess(
  config: () => CrudPageConfig,
  listPath: () => string,
  identity: () => unknown,
  operationEnabled: (operation: CrudDataAttrOperation) => boolean = () => true,
) {
  const policies = reactive<
    Partial<Record<CrudDataAttrOperation, DataAttrPolicy>>
  >({});
  const pending = new Map<CrudDataAttrOperation, Promise<DataAttrPolicy>>();
  let generation = 0;

  function ensure(operation: CrudDataAttrOperation) {
    if (!operationEnabled(operation))
      return Promise.reject(
        new Error('当前操作未显示或没有权限，不能读取字段策略'),
      );
    if (!isDataAttrPolicyEnabled()) {
      policies[operation] = legacyPolicy;
      return Promise.resolve(legacyPolicy);
    }
    const current = policies[operation];
    if (current) return Promise.resolve(current);
    const existing = pending.get(operation);
    if (existing) return existing;
    const snapshot = generation;
    const options = config();
    const target = resolveCrudDataAttrTarget(options, operation, listPath());
    const expression = resolveCrudDataAttrOperationExpression(
      options,
      operation,
    );
    let request: Promise<DataAttrPolicy>;
    if (expression) {
      request = loadDataAttrPolicyByOperation(expression, target);
    } else if (target) {
      request = loadDataAttrPolicy(
        target.method,
        target.path,
        target.contentType,
      );
    } else {
      request = Promise.reject(
        new Error('无法确定属性权限对应的接口，请配置 dataAttrTargets'),
      );
    }
    const promise = request
      .then((policy) => {
        if (generation !== snapshot)
          throw new Error('授权上下文已变化，请重试');
        policies[operation] = policy;
        return policy;
      })
      .finally(() => {
        if (pending.get(operation) === promise) pending.delete(operation);
      });
    pending.set(operation, promise);
    return promise;
  }

  function refresh() {
    generation++;
    pending.clear();
    for (const operation of operations)
      Reflect.deleteProperty(policies, operation);
    for (const operation of operations) {
      if (!operationEnabled(operation)) continue;
      if (operation === 'delete' && config().allowDelete === false) continue;
      if (
        operation === 'batchCreate' &&
        typeof config().apiService?.batchCreate !== 'function'
      )
        continue;
      void ensure(operation).catch(() => {
        /* 操作入口等待并展示错误，渲染期间不放行未解析字段。 */
      });
    }
  }
  watch(
    () => [
      config(),
      listPath(),
      operations.map((operation) => operationEnabled(operation)),
    ],
    refresh,
    { immediate: true },
  );
  watch(identity, (current, previous) => {
    if (current !== previous) clearDataAttrPolicies();
  });
  onScopeDispose(subscribeDataAttrPolicyInvalidation(refresh));

  function allowed(
    operation: CrudDataAttrOperation,
    direction: 'input' | 'output',
    field: CrudFieldConfig | string,
  ) {
    const policy = policies[operation];
    return Boolean(
      policy &&
      fieldAllowed(
        policy,
        direction,
        typeof field === 'string'
          ? field
          : resolveCrudDataAttrPath(field, config()),
      ),
    );
  }
  function assertInput(
    operation: CrudDataAttrOperation,
    payload: Record<string, any>,
  ) {
    const policy = policies[operation];
    if (!policy) throw new Error('属性权限尚未加载，请重试');
    assertDataAttrInput(policy, payload);
  }
  function pruneInput(
    operation: CrudDataAttrOperation,
    payload: Record<string, any>,
  ) {
    const policy = policies[operation];
    if (!policy) throw new Error('属性权限尚未加载，请重试');
    return pruneDataAttrInput(policy, payload);
  }
  function prepareAssignment(
    operation: 'create' | 'update',
    payload: Record<string, any>,
    fields: CrudFieldConfig[],
    conditionKeys: string[] = [],
  ) {
    const options = config();
    const conditions = new Set([
      'optimisticLock',
      options.recordKey || 'id',
      'orgId',
      'tenantId',
      ...(options.dataAttrConditionKeys || []),
      ...conditionKeys,
    ]);
    const assignmentFields = fields.filter((field) => {
      const path = resolveCrudDataAttrPath(field, options);
      return ![...conditions].some(
        (key) => path === key || path.startsWith(`${key}.`),
      );
    });
    // 只剔除明确赋值后再检查定位和范围；条件绝不能因裁剪而变宽。
    assertInput(
      operation,
      omitExcludedCrudFields(payload, assignmentFields, options.complexGroups),
    );
    const result = pruneInput(operation, payload);
    const policy = policies[operation];
    if (operation === 'update' && policy?.restricted) {
      const hasAssignment = assignmentFields.some((field) => {
        const path = resolveCrudDataAttrPath(field, options);
        if (Object.hasOwn(result, path)) return result[path] !== undefined;
        let value: any = result;
        for (const key of path.split('.')) value = value?.[key];
        return value !== undefined;
      });
      if (!hasAssignment)
        throw new Error('没有可更新的业务字段，请检查属性组权限');
    }
    return result;
  }
  function pruneOutput(operation: CrudDataAttrOperation, payload: any) {
    const policy = policies[operation];
    if (!policy) throw new Error('属性权限尚未加载，请重试');
    return pruneDataAttrOutput(policy, payload);
  }
  function viewOutput(operation: CrudDataAttrOperation, payload: any) {
    const policy = policies[operation];
    return policy ? pruneDataAttrOutput(policy, payload) : undefined;
  }
  function checkpoint() {
    return generation;
  }
  function assertCheckpoint(snapshot: number) {
    if (snapshot !== generation)
      throw new Error('权限上下文已变化，请重新确认后保存');
  }
  return {
    allowed,
    assertCheckpoint,
    assertInput,
    checkpoint,
    ensure,
    prepareAssignment,
    pruneInput,
    pruneOutput,
    viewOutput,
  };
}
