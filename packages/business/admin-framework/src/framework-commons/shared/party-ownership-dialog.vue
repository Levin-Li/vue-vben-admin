<script lang="ts" setup>
import { computed, onScopeDispose, ref, watch } from 'vue';
import { Button, Modal, message } from 'ant-design-vue';
import type { DataAttrPolicy, DataAttrTarget } from '../data-attr-policy';
import { loadDataAttrPolicyByOperation, subscribeDataAttrPolicyInvalidation, validatePolicy } from '../data-attr-policy';
import { authorizePartyGroups, partyOperation } from './party-ownership-model';
import { ownershipAccess } from './party-ownership-policy';
import type { PartyOwnershipChange, PartyOwnershipDescriptor } from './party-ownership-types';
import PartyOwnershipPanel from './party-ownership-panel.vue';

type Operation = 'bind' | 'adjust';
type PolicyTarget = { operation: string; target: DataAttrTarget };
type StatusLoader = (operation: Operation, record: Record<string, unknown>) => Promise<Record<string, boolean>>;
type Saver = (change: PartyOwnershipChange, record: Record<string, unknown>) => Promise<unknown>;
const props = defineProps<{
  open: boolean;
  identity: string;
  record: Record<string, unknown>;
  descriptors: PartyOwnershipDescriptor[];
  readPolicy?: PolicyTarget;
  bindPolicy: PolicyTarget;
  adjustPolicy: PolicyTarget;
  canBind: boolean;
  canAdjust: boolean;
  readOnlyReason?: string;
  userApiModuleBase?: string;
  tenantId?: string;
  loadStatus: StatusLoader;
  save: Saver;
}>();
const emit = defineEmits<{ 'update:open': [open: boolean]; changed: [] }>();
const loading = ref(false);
const saving = ref(false);
const pendingChanged = ref(false);
const panel = ref<InstanceType<typeof PartyOwnershipPanel>>();
const current = ref<Record<string, unknown>>({});
const boundStates = ref<Record<string, boolean>>({});
const readPolicy = ref<DataAttrPolicy>();
const bindPolicy = ref<DataAttrPolicy>();
const adjustPolicy = ref<DataAttrPolicy>();
let generation = 0;
const access = computed(() => ownershipAccess(readPolicy.value, bindPolicy.value, adjustPolicy.value,
  { bind: props.canBind && !props.readOnlyReason, adjust: props.canAdjust && !props.readOnlyReason }));
const groups = computed(() => authorizePartyGroups(props.descriptors, current.value, boundStates.value, access.value));
const canSubmit = computed(() => groups.value.some((group) => Boolean(partyOperation(group))));

async function policy(target: PolicyTarget): Promise<DataAttrPolicy> {
  const result = await loadDataAttrPolicyByOperation(target.operation, target.target);
  validatePolicy(result);
  if (result.operation !== target.operation) throw new Error('归属操作与字段策略不一致');
  return result;
}

async function refresh(resetRecord = false) {
  const ticket = ++generation;
  if (!props.open) return;
  loading.value = true;
  if (resetRecord) current.value = { ...props.record };
  try {
    const [read, bind, adjust, bindState, adjustState] = await Promise.all([
      props.readPolicy ? policy(props.readPolicy) : Promise.resolve(undefined),
      props.canBind ? policy(props.bindPolicy) : Promise.resolve(undefined),
      props.canAdjust ? policy(props.adjustPolicy) : Promise.resolve(undefined),
      props.canBind ? props.loadStatus('bind', current.value) : Promise.resolve<Record<string, boolean>>({}),
      props.canAdjust ? props.loadStatus('adjust', current.value) : Promise.resolve<Record<string, boolean>>({}),
    ]);
    if (ticket !== generation || !props.open) return;
    readPolicy.value = read; bindPolicy.value = bind; adjustPolicy.value = adjust;
    const merged: Record<string, boolean> = {};
    for (const descriptor of props.descriptors) {
      const left = bindState[descriptor.key], right = adjustState[descriptor.key];
      if (typeof left === 'boolean' && typeof right === 'boolean' && left !== right) continue;
      const value = typeof left === 'boolean' ? left : right;
      if (typeof value === 'boolean') merged[descriptor.key] = value;
    }
    boundStates.value = merged;
  } catch (error) {
    if (ticket !== generation) return;
    boundStates.value = {}; readPolicy.value = undefined; bindPolicy.value = undefined; adjustPolicy.value = undefined;
    message.error(error instanceof Error ? error.message : '加载归属权限失败');
  } finally { if (ticket === generation) loading.value = false; }
}

async function submit() {
  if (saving.value || loading.value) return;
  let changes: PartyOwnershipChange[];
  try { changes = panel.value?.collectChanges() || []; }
  catch (error) { message.warning(error instanceof Error ? error.message : '无法保存归属'); return; }
  if (!changes.length) { message.warning('归属没有变化'); return; }
  const ticket = generation;
  if (typeof current.value.optimisticLock !== 'number' || !Number.isInteger(current.value.optimisticLock)) {
    message.error('缺少记录版本，请刷新列表'); return;
  }
  let completed = 0;
  saving.value = true;
  try {
    for (const change of changes) {
      if (ticket !== generation || !props.open) throw new Error('授权或页面状态已变化，请重新检查');
      const version = current.value.optimisticLock as number;
      const result = await props.save(change, { ...current.value });
      if (result === false) throw new Error('服务未保存该归属');
      completed++;
      if (ticket !== generation || !props.open) throw new Error('授权或页面状态已变化，请重新检查');
      panel.value?.markCommitted(change);
      const next: Record<string, unknown> = { ...current.value, optimisticLock: version + 1 };
      if (change.orgChanged) next[change.orgField] = change.orgId ?? null;
      if (change.userChanged) next[change.userField] = change.userId ?? null;
      current.value = next;
    }
    if (ticket !== generation || !props.open) throw new Error('授权或页面状态已变化，请重新检查');
    emit('changed');
    pendingChanged.value = false;
    message.success('归属已保存');
    emit('update:open', false);
  } catch (error) {
    if (completed) {
      pendingChanged.value = true;
      if (props.open) await refresh();
    }
    const reason = error instanceof Error ? error.message : '保存归属失败';
    message.error(completed ? `已保存 ${completed} 项，其余未保存：${reason}` : reason);
  } finally { saving.value = false; }
}

function cancel() {
  if (saving.value) return;
  if (pendingChanged.value) { emit('changed'); pendingChanged.value = false; }
  emit('update:open', false);
}

watch(() => [props.open, props.identity, props.canBind, props.canAdjust, props.record.id] as const,
  () => { if (props.open) void refresh(true); else { generation++; boundStates.value = {}; } }, { immediate: true });
const unsubscribe = subscribeDataAttrPolicyInvalidation(() => { if (props.open) void refresh(); });
onScopeDispose(() => { generation++; unsubscribe(); });
</script>

<template>
  <Modal :open="open" title="绑定归属" width="760px" :closable="!saving" :mask-closable="!saving"
    :keyboard="!saving" @cancel="cancel">
    <div v-if="readOnlyReason" class="party-ownership-read-only">{{ readOnlyReason }}</div>
    <div v-if="loading">正在加载归属权限...</div>
    <PartyOwnershipPanel v-show="!loading" ref="panel" :groups="groups" :saving="saving" :reset-key="`${identity}:${record.id}`"
      :user-api-module-base="userApiModuleBase" :tenant-id="tenantId || (typeof current.tenantId === 'string' ? current.tenantId : undefined)" />
    <template #footer>
      <Button :disabled="saving" @click="cancel">取消</Button>
      <Button v-if="canSubmit" type="primary" :loading="saving" :disabled="loading" @click="submit">确定</Button>
    </template>
  </Modal>
</template>

<style scoped>
.party-ownership-read-only { margin-bottom: 12px; color: hsl(var(--muted-foreground)); }
</style>
