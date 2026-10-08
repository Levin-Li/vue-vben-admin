<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import { ref, watch } from 'vue';

import { UserOrgSelector } from '@levin/admin-framework';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';

// 只使用当前主体有权访问的组织树；范围选择不能授予额外权限。
const props = withDefaults(
  defineProps<{
    modelValue?: UserOrgSelectorRecord;
    placeholder?: string;
  }>(),
  {
    modelValue: undefined,
    placeholder: '选择受理组织',
  },
);
const emit = defineEmits<{ change: [undefined | UserOrgSelectorRecord] }>();
const selected = ref<undefined | UserOrgSelectorRecord>(props.modelValue);
// 页面重建列表后继续回显已授权的当前组织，不从组件内部状态猜测查询范围。
watch(
  () => props.modelValue,
  (value) => {
    selected.value = value;
  },
);
const loadTree = () =>
  rbacService.fetchAuthorizedOrgTree({ assembleTree: true });
function change(records: UserOrgSelectorRecord[]) {
  selected.value = records[0];
  emit('change', records[0]);
}
</script>
<template>
  <UserOrgSelector
    :model-value="selected"
    :selectable-types="['org']"
    value-mode="record"
    :multiple="false"
    :show-tenant-nodes="true"
    :load-org-tree="loadTree"
    :placeholder="placeholder"
    @update:selected-records="change"
  />
</template>
