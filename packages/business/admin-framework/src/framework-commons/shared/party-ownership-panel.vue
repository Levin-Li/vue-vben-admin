<script lang="ts" setup>
import { computed, reactive, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { UserOrgSelectorModelValue, UserOrgSelectorRecord } from './user-org-selector-types';
import type { PartyOwnershipChange, PartyOwnershipGroup } from './party-ownership-types';
import { buildPartyChange, partyOperation, visiblePartyGroups } from './party-ownership-model';
import { getCrudUserLoadApi, getCrudUserResolveRecords } from './crud-user-selector';
import { getAuthorizedOrgTenantId, getCrudOrgLoadApi } from './crud-org-selector';
import type { CrudFieldConfig } from './types';
import UserOrgSelector from './user-org-selector.vue';

const props = defineProps<{ groups: PartyOwnershipGroup[]; saving?: boolean; resetKey?: string; userApiModuleBase?: string; tenantId?: string }>();
const visibleGroups = computed(() => visiblePartyGroups(props.groups));
type PartyValues = { orgId?: null | string; userId?: null | string };
const values = reactive<Record<string, PartyValues>>({});
const baselines = reactive<Record<string, PartyValues>>({});
const same = (a: PartyValues, b: PartyValues) => (a.orgId || null) === (b.orgId || null) && (a.userId || null) === (b.userId || null);
const selectorField = { key: 'owner', label: '负责人' } as CrudFieldConfig;
const resolveUsers = computed(() => props.userApiModuleBase
  ? getCrudUserResolveRecords(selectorField, props.userApiModuleBase, props.tenantId)
  : undefined);
const loadOrganizations = computed(() => getCrudOrgLoadApi(selectorField, props.tenantId));
const loadUsers = computed(() => {
  if (!props.userApiModuleBase) return undefined;
  const apiModuleBase = props.userApiModuleBase;
  return async (context: Parameters<ReturnType<typeof getCrudUserLoadApi>>[0]) => {
    const tenant = props.tenantId || await getAuthorizedOrgTenantId(context.orgId);
    const load = getCrudUserLoadApi(selectorField, apiModuleBase, tenant);
    return (await load(context)).map((user) => ({ ...user, orgId: context.orgId, tenantId: tenant }));
  };
});

let previousResetKey = props.resetKey;
watch(() => [props.resetKey, props.groups] as const, ([resetKey, groups]) => {
  if (resetKey !== previousResetKey) {
    for (const key of Object.keys(values)) delete values[key];
    for (const key of Object.keys(baselines)) delete baselines[key];
    previousResetKey = resetKey;
  }
  for (const group of groups) {
    const next = { orgId: group.orgId, userId: group.userId };
    const previous = baselines[group.key];
    const current = values[group.key];
    if (!previous || !current || same(current, previous)) values[group.key] = { ...next };
    baselines[group.key] = next;
  }
}, { immediate: true, deep: true });

function setOrg(group: PartyOwnershipGroup, value: UserOrgSelectorModelValue) {
  if (typeof value === 'string' || value == null) values[group.key]!.orgId = value;
}

function setUser(group: PartyOwnershipGroup, selected: null | UserOrgSelectorRecord | UserOrgSelectorRecord[]) {
  const person = Array.isArray(selected) ? selected[0] : selected;
  const state = values[group.key]!;
  if (!person) { state.userId = null; return; }
  const orgId = String(person.orgId || person.raw?.orgId || '').trim();
  if (!orgId) { message.warning('所选人员没有所属组织'); return; }
  if (!group.canWriteUser || (!group.canWriteOrg && orgId !== (state.orgId || ''))) {
    message.warning('没有修改所选人员或所属组织的权限'); return;
  }
  state.userId = person.id;
  state.orgId = orgId;
}

function collectChanges(): PartyOwnershipChange[] {
  const available = new Map(visibleGroups.value.map((group) => [group.key, group]));
  const changes: PartyOwnershipChange[] = [];
  for (const key of Object.keys(values)) {
    const state = values[key], original = baselines[key];
    if (!state || !original || same(state, original)) continue;
    const group = available.get(key);
    if (!group) throw new Error('归属权限已变化，请刷新后重试');
    changes.push(buildPartyChange(group, state.orgId, state.userId));
  }
  return changes;
}
function markCommitted(change: PartyOwnershipChange) {
  const baseline = baselines[change.group];
  if (!baseline) return;
  baselines[change.group] = {
    orgId: change.orgChanged ? change.orgId ?? null : baseline.orgId,
    userId: change.userChanged ? change.userId ?? null : baseline.userId,
  };
}
defineExpose({ collectChanges, markCommitted });
</script>

<template>
  <div class="party-ownership-panel">
    <div v-if="visibleGroups.length === 0" class="party-ownership-empty">没有可查看的归属</div>
    <section v-for="group in visibleGroups" :key="group.key" class="party-ownership-group">
      <div class="party-ownership-fields">
        <label v-if="group.canReadOrg || group.canWriteOrg">
          <span>{{ group.orgLabel }}</span>
          <UserOrgSelector
            :model-value="values[group.key]?.orgId"
            :selectable-types="['org']"
            :load-org-tree="loadOrganizations"
            :org-types="group.orgTypes || []"
            :org-categories="group.orgCategories || []"
            :only-show-type-match-node="Boolean(group.orgTypes?.length || group.orgCategories?.length)"
            :max-select-count="1"
            :allow-clear="false"
            :disabled="!partyOperation(group) || !group.canWriteOrg || saving || Boolean(values[group.key]?.userId) || (!group.canReadUser && group.bound)"
            load-on-initial-value
            :placeholder="`请选择${group.orgLabel}`"
            @update:model-value="(value) => setOrg(group, value)"
          />
        </label>
        <label v-if="group.canReadUser || group.canWriteUser">
          <span>{{ group.userLabel }}</span>
          <UserOrgSelector
            :model-value="values[group.key]?.userId"
            :selectable-types="['user']"
            :user-api-module-base="userApiModuleBase"
            :load-org-tree="loadOrganizations"
            :load-users="loadUsers"
            :resolve-records="resolveUsers"
            :org-types="group.orgTypes || []"
            :org-categories="group.orgCategories || []"
            :only-show-type-match-node="Boolean(group.orgTypes?.length || group.orgCategories?.length)"
            :max-select-count="1"
            :disabled="!partyOperation(group) || !group.canWriteUser || saving"
            load-on-initial-value
            :placeholder="`请选择${group.userLabel}`"
            @change="(selected) => setUser(group, selected)"
          />
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.party-ownership-panel { display: grid; }
.party-ownership-group { padding: 16px 0; }
.party-ownership-group:first-of-type { padding-top: 0; }
.party-ownership-group:last-of-type { padding-bottom: 0; }
.party-ownership-group + .party-ownership-group { border-top: 1px solid hsl(var(--border)); }
.party-ownership-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.party-ownership-fields label { display: grid; gap: 6px; min-width: 0; }
.party-ownership-empty { color: hsl(var(--muted-foreground)); }
</style>
