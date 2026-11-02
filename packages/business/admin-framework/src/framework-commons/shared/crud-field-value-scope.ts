import type {
  DataAttrPolicy,
  DataAttrValueFieldBinding,
} from '../data-attr-policy';

import { shallowRef } from 'vue';

/** 后端计算的匿名完整角色分支，不能用扁平权限列表替代。 */
export interface FieldValueGrant {
  branches: Record<string, string[]>[];
  entityClass: string;
  fields: Pick<
    DataAttrValueFieldBinding,
    'attribute' | 'sourceKey' | 'sourceKind'
  >[];
  operation: string;
  state: 'denied' | 'limited' | 'unrestricted';
}
export interface FieldValueGrants {
  allowed: FieldValueGrant[];
  version: number;
}

const grants = shallowRef<FieldValueGrants | undefined>();

export function clearFieldValueGrants() {
  grants.value = undefined;
}

/** 服务器确认此操作受控时，旧契约不得将其误判为普通表单。 */
export function assertValueScopeContract(policy: DataAttrPolicy) {
  const bindings = policy.valueFields || [];
  const operationGrants =
    grants.value?.allowed.filter(
      (entry) => entry.operation === policy.operation,
    ) || [];
  if (
    bindings.some((field) => !field.mapped && field.mappingStatus !== 'absent')
  )
    throw new Error('受控字段未能映射到请求表单，无法安全编辑');
  for (const entry of operationGrants) {
    for (const field of entry.fields) {
      if (
        !bindings.some(
          (binding) =>
            binding.entityClass === entry.entityClass &&
            binding.attribute === field.attribute &&
            binding.sourceKind === field.sourceKind &&
            binding.sourceKey === field.sourceKey,
        )
      )
        throw new Error('接口缺少受控字段值静态契约，无法安全编辑');
    }
  }
  for (const binding of bindings.filter((field) => field.mapped)) {
    const entry = operationGrants.find(
      (grant) => grant.entityClass === binding.entityClass,
    );
    if (
      !entry ||
      !entry.fields.some(
        (field) =>
          field.attribute === binding.attribute &&
          field.sourceKind === binding.sourceKind &&
          field.sourceKey === binding.sourceKey,
      )
    )
      throw new Error('当前用户的字段值授权缺失，无法安全编辑');
  }
}

/** 未提供或无效的快照不授予受控字段任何值。 */
export function initializeFieldValueGrants(
  value: FieldValueGrants | undefined,
) {
  clearFieldValueGrants();
  if (value === undefined) return;
  if (
    value.version !== 1 ||
    !Array.isArray(value.allowed) ||
    value.allowed.some(
      (entry) =>
        !entry ||
        typeof entry.operation !== 'string' ||
        !entry.operation ||
        typeof entry.entityClass !== 'string' ||
        !entry.entityClass ||
        !['denied', 'limited', 'unrestricted'].includes(entry.state) ||
        !Array.isArray(entry.fields) ||
        entry.fields.some(
          (field) =>
            !field ||
            typeof field.attribute !== 'string' ||
            !field.attribute ||
            typeof field.sourceKey !== 'string' ||
            !field.sourceKey ||
            !['dict', 'enum'].includes(field.sourceKind),
        ) ||
        !Array.isArray(entry.branches) ||
        entry.branches.some(
          (branch) =>
            !branch ||
            typeof branch !== 'object' ||
            Array.isArray(branch) ||
            Object.values(branch).some(
              (items) =>
                !Array.isArray(items) ||
                items.some((item) => typeof item !== 'string'),
            ),
        ),
    )
  )
    throw new Error('登录字段值范围数据无效');
  const identities = new Set<string>();
  for (const entry of value.allowed) {
    const key = `${entry.operation}\0${entry.entityClass}`;
    if (identities.has(key)) throw new Error('登录字段值范围存在重复实体');
    identities.add(key);
    const attributes = new Set(entry.fields.map((field) => field.attribute));
    if (
      attributes.size !== entry.fields.length ||
      (entry.state === 'limited' &&
        entry.branches.some((branch) =>
          entry.fields.some(
            (field) =>
              !Object.hasOwn(branch, field.attribute) ||
              !branch[field.attribute]?.length,
          ),
        ))
    )
      throw new Error('登录字段值范围角色分支无效');
  }
  grants.value = {
    version: 1,
    allowed: value.allowed.map((entry) => ({
      operation: entry.operation,
      entityClass: entry.entityClass,
      state: entry.state,
      fields: entry.fields.map((field) => ({ ...field })),
      branches: entry.branches.map((branch) =>
        Object.fromEntries(
          Object.entries(branch).map(([key, items]) => [key, [...items]]),
        ),
      ),
    })),
  };
}

function matchesPath(binding: DataAttrValueFieldBinding, path: string) {
  return (
    binding.mapped &&
    (binding.modelPath.join('.') === path ||
      binding.wirePath.join('.') === path)
  );
}

/** undefined 表示非受控字段；空集合表示受控字段没有可选值。 */
export function allowedFieldValues(
  policy: DataAttrPolicy | undefined,
  path: string,
  formValues: Record<string, unknown>,
  requireCompleteContext = false,
): Set<string> | undefined {
  const bindings = policy?.valueFields || [];
  if (
    bindings.some(
      (binding) => !binding.mapped && binding.mappingStatus !== 'absent',
    )
  )
    return new Set();
  const matches = bindings.filter((binding) => matchesPath(binding, path));
  if (matches.length === 0) return undefined;
  if (matches.length !== 1 || !policy?.operation) return new Set();
  const target = matches[0];
  if (!target) return new Set();
  const matchingGrants =
    grants.value?.allowed.filter(
      (item) =>
        item.operation === policy.operation &&
        item.entityClass === target.entityClass,
    ) || [];
  if (matchingGrants.length !== 1) return new Set();
  const grant = matchingGrants[0];
  if (!grant) return new Set();
  if (
    !grant.fields.some(
      (field) =>
        field.attribute === target.attribute &&
        field.sourceKind === target.sourceKind &&
        field.sourceKey === target.sourceKey,
    )
  )
    return new Set();
  if (grant.state === 'denied') return new Set();
  if (grant.state === 'unrestricted') return undefined;
  const entityBindings = bindings.filter(
    (binding) => binding.entityClass === target.entityClass,
  );
  if (
    grant.fields.some(
      (field) =>
        !entityBindings.some(
          (binding) =>
            binding.attribute === field.attribute &&
            binding.sourceKind === field.sourceKind &&
            binding.sourceKey === field.sourceKey,
        ),
    )
  )
    return new Set();
  const branches = grant.branches.filter((branch) =>
    entityBindings.every((binding) => {
      if (binding.attribute === target.attribute) return true;
      // 请求模型确认不包含其他受控字段时，无法从表单推断当前记录所命中的分支。
      if (!binding.mapped) return false;
      const value =
        formValues[binding.modelPath.join('.')] ??
        formValues[binding.wirePath.join('.')];
      if (value === undefined || value === null || value === '')
        return !requireCompleteContext;
      const selected = Array.isArray(value) ? value : [value];
      return selected.every((item) =>
        branch[binding.attribute]?.includes(String(item)),
      );
    }),
  );
  return new Set(branches.flatMap((branch) => branch[target.attribute] || []));
}

function lookupPath(record: Record<string, unknown>, path: string[]) {
  const values: unknown[] = [];
  function visit(value: unknown, index: number) {
    if (index === path.length) {
      if (value !== undefined) values.push(value);
      return;
    }
    if (!value || typeof value !== 'object') return;
    // 请求对象既可使用嵌套属性，也可在任意层使用点号键；所有写法均须检查。
    for (let end = index + 1; end <= path.length; end++) {
      const key = path.slice(index, end).join('.');
      if (Object.hasOwn(value, key))
        visit((value as Record<string, unknown>)[key], end);
    }
  }
  if (path.length > 0) visit(record, 0);
  if (
    values.some((value) => JSON.stringify(value) !== JSON.stringify(values[0]))
  )
    throw new Error('受控字段请求值存在歧义');
  return { found: values.length > 0, value: values[0] };
}

function scopeValues(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const values = Array.isArray(value) ? value : [value];
  if (
    values.length === 0 ||
    values.some((item) => typeof item !== 'string' && typeof item !== 'number')
  )
    return undefined;
  return values.map(String);
}

/** 只在提交受控字段时检查目标组合；未知旧值不阻断对无关字段的修改。 */
export function assertFieldValueAssignment(
  policy: DataAttrPolicy,
  payload: Record<string, unknown>,
  initialValues: Record<string, unknown>,
  updating: boolean,
) {
  assertValueScopeContract(policy);
  const bindings = policy.valueFields || [];
  const entries =
    grants.value?.allowed.filter(
      (entry) => entry.operation === policy.operation,
    ) || [];
  for (const entry of entries) {
    const entityBindings = bindings.filter(
      (binding) => binding.entityClass === entry.entityClass,
    );
    const submitted = entityBindings.filter((binding) => {
      if (!binding.mapped) return false;
      const model = lookupPath(payload, binding.modelPath);
      const wire = lookupPath(payload, binding.wirePath);
      if (
        model.found &&
        wire.found &&
        JSON.stringify(model.value) !== JSON.stringify(wire.value)
      )
        throw new Error('受控字段请求值存在歧义');
      return model.found || wire.found;
    });
    if (submitted.length === 0) continue;
    const getSubmitted = (binding: DataAttrValueFieldBinding) => {
      const model = lookupPath(payload, binding.modelPath);
      const wire = lookupPath(payload, binding.wirePath);
      if (
        model.found &&
        wire.found &&
        JSON.stringify(model.value) !== JSON.stringify(wire.value)
      )
        throw new Error('受控字段请求值存在歧义');
      return model.found ? model.value : wire.value;
    };
    const original = (binding: DataAttrValueFieldBinding) =>
      initialValues[binding.modelPath.join('.')] ??
      initialValues[binding.wirePath.join('.')];
    if (
      updating &&
      submitted.every((binding) => {
        const before = scopeValues(original(binding));
        const after = scopeValues(getSubmitted(binding));
        return (
          before !== undefined &&
          after !== undefined &&
          JSON.stringify(before) === JSON.stringify(after)
        );
      })
    )
      continue;
    if (entry.state === 'unrestricted') continue;
    if (entry.state === 'denied') throw new Error('当前接口没有允许的字段值');
    const values = new Map<string, string[]>();
    for (const field of entry.fields) {
      const binding = entityBindings.find(
        (candidate) =>
          candidate.attribute === field.attribute &&
          candidate.sourceKind === field.sourceKind &&
          candidate.sourceKey === field.sourceKey,
      );
      if (!binding?.mapped)
        throw new Error('无法确定受控字段原值，请使用有完整范围信息的接口');
      const supplied = submitted.includes(binding);
      const value = scopeValues(
        supplied ? getSubmitted(binding) : original(binding),
      );
      if (!value) throw new Error('无法确定受控字段的完整值组合');
      values.set(field.attribute, value);
    }
    if (
      !entry.branches.some((branch) =>
        [...values].every(([key, selected]) =>
          selected.every((value) => branch[key]?.includes(value)),
        ),
      )
    )
      throw new Error('选择的字段值组合超出当前接口允许范围');
  }
}
