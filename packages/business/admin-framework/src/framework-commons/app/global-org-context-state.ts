import type { UserOrgSelectorRecord } from '../shared/user-org-selector-types';

import { computed, ref } from 'vue';

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

  if (!id || !['tenant', 'org', 'user'].includes(String(record.kind))) {
    return undefined;
  }

  const orgId = record.kind === 'org' ? id : normalizeId(record.orgId);

  return {
    ...record,
    id,
    kind: record.kind,
    orgId,
    tenantId: normalizeId(record.tenantId) || (record.kind === 'tenant' ? id : undefined),
  } as UserOrgSelectorRecord;
}

// 配置未加载或已关闭时默认禁止补值；不依赖界面是否可见。
let contextEnabled = false;

/** 运行时开关关闭后先停止注入，再清空选择以免刷新请求带入旧范围。 */
export function setGlobalUserOrgContextEnabled(enabled: boolean) {
  contextEnabled = enabled;
  if (!enabled) {
    setCurrentGlobalUserOrgRecord(undefined);
  }
}

export function isGlobalUserOrgContextEnabled() {
  return contextEnabled;
}

const selectedRecordRef = ref<UserOrgSelectorRecord>();
const selectedRecordsRef = ref<UserOrgSelectorRecord[]>([]);
const multipleRef = ref(false);
const revisionRef = ref(0);
const listeners = new Set<
  (record: undefined | UserOrgSelectorRecord) => void
>();

export const currentGlobalUserOrgRecord = computed(
  () => selectedRecordRef.value,
);
export const currentGlobalUserOrgRecords = computed(
  () => selectedRecordsRef.value,
);
export const globalOrgContextMultiple = computed(() => multipleRef.value);
export const currentGlobalOrgIds = computed(() => [
  ...new Set(
    selectedRecordsRef.value.map((record) => record.orgId).filter(Boolean),
  ),
]);
export const currentGlobalOwnerIds = computed(() => [
  ...new Set(
    selectedRecordsRef.value
      .filter((record) => record.kind === 'user')
      .map((record) => record.id),
  ),
]);
export const currentGlobalTenantId = computed(() => {
  const tenantIds = [
    ...new Set(
      selectedRecordsRef.value
        .map((record) => normalizeId(record.tenantId))
        .filter(Boolean),
    ),
  ];
  return tenantIds.length === 1 ? tenantIds[0] : undefined;
});
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

export function applyCurrentGlobalUserOrgContextToParams(
  params: Record<string, any> | undefined,
  _options: GlobalUserOrgInjectionRules & {
    request?: GlobalUserOrgInjectionContext['request'];
    skip?: boolean;
    user?: GlobalUserOrgInjectionContext['user'];
  } = {},
) {
  // 全局上下文已改为请求头传递，绝不再改写业务查询参数。
  return params;
  /*
  const selected = currentGlobalUserOrgRecord.value;
  if (!contextEnabled || options.skip || !selected) {
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
  return result; */
}

export function applyCurrentGlobalOrgIdToParams(
  params: Record<string, any> | undefined,
) {
  return applyCurrentGlobalUserOrgContextToParams(params);
}

export function setCurrentGlobalUserOrgRecords(
  value: unknown,
  multiple = false,
) {
  const source = Array.isArray(value) ? value : [value];
  const records = source
    .map((item) => normalizeSelectedRecord(item))
    .filter(Boolean) as UserOrgSelectorRecord[];
  const next = multiple ? records : records.slice(0, 1);
  const previous = selectedRecordsRef.value;
  if (
    multipleRef.value === multiple &&
    previous.length === next.length &&
    previous.every(
      (record, index) =>
        record.id === next[index]?.id &&
        record.kind === next[index]?.kind &&
        record.orgId === next[index]?.orgId &&
        record.tenantId === next[index]?.tenantId,
    )
  ) {
    return false;
  }
  multipleRef.value = multiple;
  selectedRecordsRef.value = next;
  const record = next[0];
  selectedRecordRef.value = record;
  revisionRef.value += 1;
  listeners.forEach((listener) => listener(record));
  return true;
}

export function setCurrentGlobalUserOrgRecord(value: unknown) {
  return setCurrentGlobalUserOrgRecords(value, false);
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
