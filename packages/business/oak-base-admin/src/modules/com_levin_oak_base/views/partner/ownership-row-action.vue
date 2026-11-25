<script lang="ts" setup>
import { computed, ref } from 'vue';
import { Button } from 'ant-design-vue';
import { useAccessStore, useUserStore } from '@vben/runtime/stores';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { canMutateCrudRecord } from '@levin/admin-framework/framework-commons/shared/crud-editable-access';
import PartyOwnershipDialog from '@levin/admin-framework/framework-commons/shared/party-ownership-dialog.vue';
import type { PartyOwnershipChange, PartyOwnershipDescriptor } from '@levin/admin-framework/framework-commons/shared/party-ownership-types';
import { OAK_BASE_API_MODULE } from '../../api/_module';

type Id = { id: string; tenantId?: string };
type Payload = Record<string, unknown> & { id: string };
type Service = {
  bindOwnershipStatus(params: Id): Promise<Record<string, boolean>>;
  adjustOwnershipStatus(params: Id): Promise<Record<string, boolean>>;
  bindOwnership(group: string, data: Payload): Promise<unknown>;
  adjustOwnership(group: string, data: Payload): Promise<unknown>;
};
const props = defineProps<{
  record: Record<string, unknown>;
  reload: () => Promise<void>;
  service: Service;
  resource: string;
  label: string;
  listPath?: string;
  descriptors: PartyOwnershipDescriptor[];
}>();
const { hasPermission } = useRbacAccess();
const user = useUserStore();
const access = useAccessStore();
const identity = computed(() => JSON.stringify([user.userInfo, access.accessCodes]));
const tenantId = computed(() => typeof props.record.tenantId === 'string' ? props.record.tenantId
  : typeof (user.userInfo as Record<string, unknown> | null)?.tenantId === 'string'
    ? (user.userInfo as Record<string, string>).tenantId : undefined);
const open = ref(false);
function permitted(method: string) {
  const candidates = buildApiMethodPermissions(props.service, method);
  return candidates.length > 0 && hasPermission(candidates);
}
const hasBind = computed(() => permitted('bindOwnership'));
const hasAdjust = computed(() => permitted('adjustOwnership'));
const canMutate = computed(() => canMutateCrudRecord([], props.record, user.userInfo));
const canRead = computed(() => permitted('list'));
const prefix = computed(() => `${OAK_BASE_API_MODULE}/${props.resource}`);
const operation = (action: string) => `com.levin.oak.base:业务数据-${props.label}::${action}`;
const bindPolicy = computed(() => ({ operation: operation('绑定归属'), target: { method: 'PUT', path: `${prefix.value}/bindOwnership/${props.descriptors[0]?.key || 'unknown'}` } }));
const adjustPolicy = computed(() => ({ operation: operation('调整归属'), target: { method: 'PUT', path: `${prefix.value}/adjustOwnership/${props.descriptors[0]?.key || 'unknown'}` } }));
const readPolicy = computed(() => canRead.value ? ({ operation: operation('查询列表'), target: { method: 'GET', path: `${prefix.value}/${props.listPath || 'list'}` } }) : undefined);
function id(record: Record<string, unknown>): Id {
  const result: Id = { id: String(record.id || '') };
  if (typeof record.tenantId === 'string') result.tenantId = record.tenantId;
  return result;
}
async function status(op: 'bind' | 'adjust', record: Record<string, unknown>) {
  return op === 'bind' ? props.service.bindOwnershipStatus(id(record)) : props.service.adjustOwnershipStatus(id(record));
}
async function save(change: PartyOwnershipChange, record: Record<string, unknown>) {
  const data: Payload = { ...id(record), optimisticLock: record.optimisticLock };
  const clear: string[] = [];
  if (change.orgChanged) { data[change.orgField] = change.orgId ?? null; if (change.orgId == null) clear.push(change.orgField); }
  if (change.userChanged) { data[change.userField] = change.userId ?? null; if (change.userId == null) clear.push(change.userField); }
  if (clear.length) data.forceUpdateFields = clear;
  if (change.operation === 'bind') return props.service.bindOwnership(change.group, data);
  return props.service.adjustOwnership(change.group, data);
}
</script>

<template>
  <Button v-if="hasBind || hasAdjust" size="small" type="link" @click="open = true">绑定归属</Button>
  <PartyOwnershipDialog v-if="open" v-model:open="open" :identity="identity" :record="record"
    :descriptors="descriptors" :read-policy="readPolicy" :bind-policy="bindPolicy" :adjust-policy="adjustPolicy"
    :user-api-module-base="OAK_BASE_API_MODULE"
    :tenant-id="tenantId"
    :can-bind="hasBind" :can-adjust="hasAdjust" :read-only-reason="canMutate ? undefined : '此记录不可编辑'"
    :load-status="status" :save="save" @changed="reload" />
</template>
