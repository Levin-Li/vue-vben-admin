<script lang="ts" setup>
import DataPermissionDialog from '@levin/admin-framework/framework-commons/shared/data-permission-dialog.vue';
import ResourcePermissionDialog from '@levin/admin-framework/framework-commons/shared/resource-permission-dialog.vue';

import { loadDomainScopeOptions } from '../../domain-scope-options';
import CrudPage from '../crud-page.vue';
import { useRolePageConfig } from './config';

const {
  config,
  dataPermissionDialogOpen,
  handleSaved,
  pageKey,
  resourcePermissionDialogOpen,
  selectedDataPermissionRecord,
  selectedResourcePermissionRecord,
} = useRolePageConfig();
</script>

<template>
  <div>
    <CrudPage :key="pageKey" :config="config" />
    <ResourcePermissionDialog
      v-if="selectedResourcePermissionRecord"
      v-model:open="resourcePermissionDialogOpen"
      api-base="/Role"
      permission-field="permissionList"
      :record="selectedResourcePermissionRecord"
      subject-label="角色"
      title="角色资源权限分配"
      @saved="handleSaved"
    />
    <DataPermissionDialog
      v-if="selectedDataPermissionRecord"
      v-model:open="dataPermissionDialogOpen"
      :record="selectedDataPermissionRecord"
      :load-domain-options="loadDomainScopeOptions"
      subject-type="role"
      @saved="handleSaved"
    />
  </div>
</template>
