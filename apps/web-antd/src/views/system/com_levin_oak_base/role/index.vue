<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import DataPermissionDialog from '../../shared/data-permission-dialog.vue';
import ResourcePermissionDialog from '../../shared/resource-permission-dialog.vue';
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
      subject-type="role"
      @saved="handleSaved"
    />
  </div>
</template>
