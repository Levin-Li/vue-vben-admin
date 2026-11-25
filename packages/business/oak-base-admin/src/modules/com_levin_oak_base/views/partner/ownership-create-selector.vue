<script setup lang="ts">
import UserOrgSelector from '@levin/admin-framework/framework-commons/shared/user-org-selector.vue';
import { getCrudUserLoadApi } from '@levin/admin-framework/framework-commons/shared/crud-user-selector';
import { getAuthorizedOrgTenantId, getCrudOrgLoadApi } from '@levin/admin-framework/framework-commons/shared/crud-org-selector';
import type { CrudFieldConfig } from '@levin/admin-framework/framework-commons/shared/types';
import { useUserStore } from '@vben/runtime/stores';
import { computed } from 'vue';
import { message } from 'ant-design-vue';
const props = defineProps<{
  formState: Record<string, any>;
  field: string;
  orgField: string;
  userField: string;
  disabled?: boolean;
  orgTypes?: string[];
  orgCategories?: string[];
}>();
const user = useUserStore();
const tenantId = computed(() => String(props.formState.tenantId || (user.userInfo as Record<string, unknown> | null)?.tenantId || '') || undefined);
const selectorField = { key: 'owner', label: '负责人' } as CrudFieldConfig;
const loadOrganizations = computed(() => getCrudOrgLoadApi(selectorField, tenantId.value));
const loadUsers = computed(() => {
  return async (context: Parameters<ReturnType<typeof getCrudUserLoadApi>>[0]) => {
    const tenant = tenantId.value || await getAuthorizedOrgTenantId(context.orgId);
    const load = getCrudUserLoadApi(selectorField, '/com.levin.oak.base/V1/api', tenant);
    return (await load(context)).map((item) => ({ ...item, orgId: context.orgId, tenantId: tenant }));
  };
});
function selectPerson(value: unknown) {
  const selected = Array.isArray(value) ? value[0] : value;
  if (!selected || typeof selected !== 'object') return;
  const person = selected as { orgId?: unknown; raw?: { orgId?: unknown } };
  const org = String(person.orgId || person.raw?.orgId || '').trim();
  if (!org) { props.formState[props.userField] = undefined; message.warning('所选人员没有所属组织'); return; }
  props.formState[props.orgField] = org;
}
</script>
<template>
  <UserOrgSelector :model-value="formState[field]" :selectable-types="[field === orgField ? 'org' : 'user']"
    user-api-module-base="/com.levin.oak.base/V1/api"
    :load-org-tree="loadOrganizations" :load-users="loadUsers"
    :org-types="orgTypes || []" :org-categories="orgCategories || []" :only-show-type-match-node="Boolean(orgTypes?.length || orgCategories?.length)"
    :disabled="disabled || (field === orgField && Boolean(formState[userField]))" :max-select-count="1" load-on-initial-value
    @update:model-value="(value) => formState[field] = value"
    @change="(value) => { if (field === userField) selectPerson(value); }" />
</template>
