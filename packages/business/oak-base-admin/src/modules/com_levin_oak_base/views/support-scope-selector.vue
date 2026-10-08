<script setup lang="ts">
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import { ref } from 'vue';

import { UserOrgSelector } from '@levin/admin-framework';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';

// 只使用当前主体有权访问的组织树；范围选择不能授予额外权限。
withDefaults(defineProps<{ placeholder?: string }>(), {
  placeholder: '选择受理组织',
});
const emit = defineEmits<{ change: [undefined | UserOrgSelectorRecord] }>();
const selected = ref<UserOrgSelectorRecord>();
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
