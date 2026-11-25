<script lang="ts" setup>
import type { ResourcePermissionChanges } from '@levin/admin-framework/framework-commons/shared/resource-permission-types';

import DataPermissionDialog from '@levin/admin-framework/framework-commons/shared/data-permission-dialog.vue';
import ResourcePermissionDialog from '@levin/admin-framework/framework-commons/shared/resource-permission-dialog.vue';

import { roleService } from '../../api/role-service';
import { createDataPermissionCallbacks } from '../../data-permission-adapter';
import CrudPage from '../crud-page.vue';
import { isGeneratedReportMenuPath } from '../report-center/report-menu-permission';
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

// 目标定位留在角色页面，弹窗只通过回调取得归一化详情和提交变更。
function dataPermissionCallbacks() {
  if (!selectedDataPermissionRecord.value) throw new Error('未选择角色');
  return createDataPermissionCallbacks(
    selectedDataPermissionRecord.value,
    'role',
  );
}

const loadDataPermissionTarget = () => dataPermissionCallbacks().loadTarget();
const saveDataPermissionTarget = (changes: Record<string, any>) =>
  dataPermissionCallbacks().saveTarget(changes);

async function loadResourcePermissionTarget() {
  const id = selectedResourcePermissionRecord.value?.id;
  if (!id) throw new Error('未选择角色');
  const detail = (await roleService.retrieve({ id })) as Record<string, any>;
  return {
    code: detail.code,
    id: String(detail.id),
    name: String(detail.name || ''),
    optimisticLock: detail.optimisticLock,
    permissions: Array.isArray(detail.permissionList)
      ? detail.permissionList.map(String)
      : [],
  };
}

async function saveResourcePermissionTarget(
  changes: ResourcePermissionChanges,
) {
  return roleService.update({
    autoForceUpdateField: false,
    forceUpdateFields: ['permissionList'],
    id: changes.id,
    ...(changes.optimisticLock === undefined
      ? {}
      : { optimisticLock: changes.optimisticLock }),
    permissionList: changes.permissions,
  });
}
</script>

<template>
  <div>
    <CrudPage :key="pageKey" :config="config" />
    <ResourcePermissionDialog
      v-if="selectedResourcePermissionRecord"
      :key="selectedResourcePermissionRecord.id"
      v-model:open="resourcePermissionDialogOpen"
      :load-target="loadResourcePermissionTarget"
      :save-target="saveResourcePermissionTarget"
      :auto-include-menu-ancestors="isGeneratedReportMenuPath"
      subject-label="角色"
      title="角色资源权限分配"
      @saved="handleSaved"
    />
    <DataPermissionDialog
      v-if="selectedDataPermissionRecord"
      :key="selectedDataPermissionRecord.id"
      v-model:open="dataPermissionDialogOpen"
      :load-target="loadDataPermissionTarget"
      :save-target="saveDataPermissionTarget"
      @saved="handleSaved"
    />
  </div>
</template>
