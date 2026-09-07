import type { UserOrgSelectorRecord } from '../shared/user-org-selector-types';

import { computed, ref } from 'vue';

import { evaluateJavaScriptExpression } from '../shared/javascript-expression';

function normalizeId(value: unknown) {
  const id = String(value ?? '').trim();
  return id || undefined;
}

function normalizeSelectedRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Partial<UserOrgSelectorRecord>;
  const id = normalizeId(record.id);

  if (!id || (record.kind !== 'org' && record.kind !== 'user')) {
    return undefined;
  }

  const orgId = record.kind === 'org' ? id : normalizeId(record.orgId);

  return {
    ...record,
    id,
    kind: record.kind,
    orgId,
  } as UserOrgSelectorRecord;
}

const selectedRecordRef = ref<UserOrgSelectorRecord>();
const revisionRef = ref(0);
const listeners = new Set<
  (record: undefined | UserOrgSelectorRecord) => void
>();

export const currentGlobalUserOrgRecord = computed(
  () => selectedRecordRef.value,
);
export const currentGlobalOrgId = computed(
  () => selectedRecordRef.value?.orgId,
);
export const currentGlobalOwnerId = computed(() =>
  selectedRecordRef.value?.kind === 'user'
    ? selectedRecordRef.value.id
    : undefined,
);
export const globalOrgContextRevision = computed(() => revisionRef.value);

export function getCurrentGlobalOrgId() {
  return currentGlobalOrgId.value;
}

export function getCurrentGlobalOwnerId() {
  return currentGlobalOwnerId.value;
}

export interface GlobalUserOrgInjectionContext {
  fieldName: 'orgId' | 'orgIdList' | 'ownerId';
  originalValue: unknown;
  params: Readonly<Record<string, any>>;
  request: Readonly<{ method?: string; url?: string }>;
  selected: Readonly<UserOrgSelectorRecord>;
  user: Readonly<Record<string, any>>;
  value: string | string[] | undefined;
}

export type GlobalUserOrgInjectionCondition =
  | ((context: GlobalUserOrgInjectionContext) => boolean)
  | boolean
  | string;

export interface GlobalUserOrgInjectionRules {
  /** 是否强制覆盖；默认 false。 */
  isOverride?: GlobalUserOrgInjectionCondition;
  /** 是否必须注入；默认仅要求当前选择能提供的字段。 */
  isRequired?: GlobalUserOrgInjectionCondition;
}

function evaluateInjectionCondition(
  condition: GlobalUserOrgInjectionCondition | undefined,
  fallback: boolean,
  context: GlobalUserOrgInjectionContext,
) {
  let result: unknown = fallback;
  if (typeof condition === 'function') {
    result = condition(context);
  } else if (typeof condition === 'string') {
    result = evaluateJavaScriptExpression(condition, context);
  } else if (condition !== undefined) {
    result = condition;
  }

  if (typeof result !== 'boolean') {
    throw new TypeError(
      `全局参数 ${context.fieldName} 的注入条件必须返回布尔值`,
    );
  }
  return result;
}

export function applyCurrentGlobalUserOrgContextToParams(
  params: Record<string, any> | undefined,
  options: GlobalUserOrgInjectionRules & {
    request?: GlobalUserOrgInjectionContext['request'];
    skip?: boolean;
    user?: GlobalUserOrgInjectionContext['user'];
  } = {},
) {
  const selected = currentGlobalUserOrgRecord.value;
  if (options.skip || !selected) {
    return params;
  }

  const orgId = getCurrentGlobalOrgId();
  const values = {
    orgId,
    orgIdList: orgId ? [orgId] : undefined,
    ownerId: getCurrentGlobalOwnerId(),
  };
  let result = params;
  for (const fieldName of ['orgId', 'orgIdList', 'ownerId'] as const) {
    const originalValue = params?.[fieldName];
    const value = values[fieldName];
    const context: GlobalUserOrgInjectionContext = {
      fieldName,
      originalValue,
      params: params ?? {},
      request: options.request ?? {},
      selected,
      user: options.user ?? {},
      value,
    };
    const isOverride = evaluateInjectionCondition(
      options.isOverride,
      false,
      context,
    );
    const isRequired = evaluateInjectionCondition(
      options.isRequired,
      value !== undefined,
      context,
    );

    // 对齐公共对象：不覆盖时，已有值或非必填字段不参与注入。
    if (
      !isOverride &&
      ((originalValue !== null && originalValue !== undefined) || !isRequired)
    ) {
      continue;
    }
    if (value === undefined) {
      if (isRequired) {
        throw new Error(`全局选择无法提供必填参数 ${fieldName}`);
      }
      continue;
    }
    result = { ...result, [fieldName]: value };
  }
  return result;
}

export function applyCurrentGlobalOrgIdToParams(
  params: Record<string, any> | undefined,
) {
  return applyCurrentGlobalUserOrgContextToParams(params);
}

export function setCurrentGlobalUserOrgRecord(value: unknown) {
  const record = normalizeSelectedRecord(value);
  const previousRecord = selectedRecordRef.value;

  if (
    previousRecord?.id === record?.id &&
    previousRecord?.kind === record?.kind &&
    previousRecord?.orgId === record?.orgId
  ) {
    return false;
  }

  selectedRecordRef.value = record;
  revisionRef.value += 1;
  listeners.forEach((listener) => listener(record));
  return true;
}

export function setCurrentGlobalOrgId(value: unknown) {
  const orgId = normalizeId(value);
  return setCurrentGlobalUserOrgRecord(
    orgId ? { id: orgId, kind: 'org', name: orgId } : undefined,
  );
}

export function onGlobalUserOrgContextChange(
  listener: (record: undefined | UserOrgSelectorRecord) => void,
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onGlobalOrgIdChange(
  listener: (orgId: string | undefined) => void,
) {
  return onGlobalUserOrgContextChange((record) => listener(record?.orgId));
}
