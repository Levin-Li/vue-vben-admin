<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import { message, Modal, Select } from 'ant-design-vue';

import {
  buildApiMethodPermissions,
  buildCrudOperationPermissions,
} from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import DataPermissionDialog from '@levin/admin-framework/framework-commons/shared/data-permission-dialog.vue';

import { userService } from '../../api/user-service';
import { loadDomainScopeOptions } from '../../domain-scope-options';
import CrudPage from '../crud-page.vue';
import { getDataPermissionCount } from '../permission-action-counts';
import { roleOptionsLoader, userPageCrudConfig } from './config';

// 数据权限弹窗只接受字符串 ID，在页面边界规范化公共候选。
async function loadStringDomainScopeOptions(keyword?: string) {
  const options = await loadDomainScopeOptions(keyword);
  return options.map((option) => ({
    label: String(option.label),
    value: String(option.value),
  }));
}

const pageKey = ref(0);
const dialogOpen = ref(false);
const selectedRecord = ref<null | Record<string, any>>(null);
const roleModalOpen = ref(false);
const roleSubmitting = ref(false);
const roleOptionsLoading = ref(false);
const roleOptions = ref<Array<{ label: string; value: string }>>([]);
const roleFormState = reactive({
  id: '',
  roleList: [] as string[],
});

const userListConfig = computed(() => ({
  ...userPageCrudConfig,
  rowActions: [
    ...(userPageCrudConfig.rowActions || []),
    {
      handler: async (record: Record<string, any>) => {
        await openRoleModal(record);
      },
      label: '分配角色',
      permission: buildApiMethodPermissions(userService, 'assignRoles'),
      reloadAfterAction: false,
      successMessage: false as const,
    },
    {
      badgeCount: getDataPermissionCount,
      handler: async (record: Record<string, any>) => {
        selectedRecord.value = record;
        dialogOpen.value = true;
      },
      label: '数据权限分配',
      permission:
        userPageCrudConfig.editPermission ||
        buildCrudOperationPermissions(userPageCrudConfig, 'update'),
      reloadAfterAction: false,
      successMessage: false as const,
    },
  ],
}));

async function loadRoleOptions(keyword = '') {
  roleOptionsLoading.value = true;

  try {
    const options = await roleOptionsLoader(keyword);
    roleOptions.value = options.map((option) => ({
      label: String(option.label),
      value: String(option.value),
    }));
  } finally {
    roleOptionsLoading.value = false;
  }
}

async function openRoleModal(record: Record<string, any>) {
  roleFormState.id = String(record.id || '');
  roleFormState.roleList = Array.isArray(record.roleList)
    ? record.roleList.map((role) => String(role))
    : [];
  roleModalOpen.value = true;
  await loadRoleOptions();
}

async function submitRoleForm() {
  if (!roleFormState.id) {
    message.warning('用户ID不能为空');
    return;
  }

  roleSubmitting.value = true;

  try {
    await userService.assignRoles({
      id: roleFormState.id,
      roleList: roleFormState.roleList,
    });
    message.success('角色已分配');
    roleModalOpen.value = false;
    pageKey.value += 1;
  } finally {
    roleSubmitting.value = false;
  }
}

function handleSaved() {
  pageKey.value += 1;
}

watch(dialogOpen, (open) => {
  if (!open) {
    selectedRecord.value = null;
  }
});
</script>

<template>
  <CrudPage :key="pageKey" :config="userListConfig" />

  <DataPermissionDialog
    v-if="selectedRecord"
    v-model:open="dialogOpen"
    :record="selectedRecord"
    :load-domain-options="loadStringDomainScopeOptions"
    subject-type="user"
    @saved="handleSaved"
  />

  <Modal
    v-model:open="roleModalOpen"
    :confirm-loading="roleSubmitting"
    :mask-closable="false"
    title="分配角色"
    :width="720"
    @ok="submitRoleForm"
  >
    <Select
      v-model:value="roleFormState.roleList"
      allow-clear
      class="w-full"
      :filter-option="false"
      mode="multiple"
      :not-found-content="roleOptionsLoading ? '加载中...' : undefined"
      :options="roleOptions"
      placeholder="请选择角色"
      show-search
      @search="loadRoleOptions"
    />
  </Modal>
</template>
