<script lang="ts" setup>
import { UserOrgSelector } from '@levin/admin-framework';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';

import CrudPage from '../crud-page.vue';
import { orgPageCrudConfig } from './config';
import { disableParentSubtree } from './parent-options';

// 授权树保留原有范围，编辑时仅禁选当前组织及其后代。
async function loadParentOptions(tenantId?: string, currentId?: string) {
  const tree = tenantId
    ? await rbacService.fetchAuthorizedOrgTreeByTenant(tenantId)
    : await rbacService.fetchAuthorizedOrgTree();
  return disableParentSubtree(tree, currentId);
}
</script>

<template>
  <CrudPage :config="orgPageCrudConfig">
    <template #form-field-parentId="{ formState, editingRecord, disabled }">
      <UserOrgSelector
        :key="`${formState.tenantId || ''}:${editingRecord?.id || ''}`"
        :disabled="disabled"
        :max-select-count="1"
        :model-value="formState.parentId"
        :org-load-api="
          () => loadParentOptions(formState.tenantId, editingRecord?.id)
        "
        :selectable-types="['org']"
        load-on-initial-value
        placeholder="请选择上级组织"
        value-mode="id"
        @update:model-value="
          (value: unknown) => {
            if (!disabled)
              formState.parentId =
                typeof value === 'string' ? value : undefined;
          }
        "
      />
    </template>
  </CrudPage>
</template>
