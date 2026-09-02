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

export function applyCurrentGlobalUserOrgContextToParams(
  params: Record<string, any> | undefined,
  options: {
    skip?: boolean;
  } = {},
) {
  if (options.skip) {
    return params;
  }

  const orgId = getCurrentGlobalOrgId();
  const ownerId = getCurrentGlobalOwnerId();

  if (!orgId && !ownerId) {
    return params;
  }

  return {
    ...params,
    ...(orgId ? { orgId, orgIdList: [orgId] } : {}),
    ...(ownerId ? { ownerId } : {}),
  };
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
