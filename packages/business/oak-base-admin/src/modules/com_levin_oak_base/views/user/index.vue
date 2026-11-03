<script lang="ts" setup>
import type { UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import { computed, reactive, ref, watch } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { rbacService, UserOrgSelector } from '@levin/admin-framework';
import {
  buildApiMethodPermissions,
  buildCrudOperationPermissions,
} from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import DataPermissionDialog from '@levin/admin-framework/framework-commons/shared/data-permission-dialog.vue';
import { Input, message, Modal, Select } from 'ant-design-vue';

import { UserService, userService } from '../../api/user-service';
import { loadDataPermissionDomainOptions } from '../../domain-scope-options';
import CrudPage from '../crud-page.vue';
import { usePageRolePermissionRecords } from '../load-role-permission-records';
import { getUserDataPermissionBadgeItems } from '../permission-action-counts';
import { roleOptionsLoader, userPageCrudConfig } from './config';
import { canShowPasswordResetAction } from './password-reset-visibility';

// 数据权限弹窗只接受字符串 ID，在页面边界规范化公共候选。
async function loadStringDomainScopeOptions(keyword?: string) {
  const options = await loadDataPermissionDomainOptions(keyword);
  return options.map((option) => ({
    label: String(option.label),
    value: String(option.value),
  }));
}

const pageKey = ref(0);
const currentUser = useUserStore();
const {
  records: permissionRoleRecords,
  refresh: refreshRolePermissionRecords,
} = usePageRolePermissionRecords(() => currentUser.userInfo);
const selectedOrg = ref<UserOrgSelectorRecord>();
const selectedScope = computed(() =>
  selectedOrg.value?.tenantId
    ? { orgId: selectedOrg.value.id, tenantId: selectedOrg.value.tenantId }
    : undefined,
);
const scopedUserService = new UserService(() => selectedScope.value);
const scopeKey = computed(() =>
  JSON.stringify([
    currentUser.userInfo?.id,
    selectedScope.value,
    pageKey.value,
  ]),
);
let scopeGeneration = 0;
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
const passwordModalOpen = ref(false);
const passwordSubmitting = ref(false);
const passwordTarget = ref<null | { id: string; name: string }>(null);
const passwordFormState = reactive({
  newPassword: '',
  confirmPassword: '',
});

const userListConfig = computed(() => {
  const roleRecords = permissionRoleRecords.value;
  return {
    ...userPageCrudConfig,
    apiService: scopedUserService,
    rowActions: [
      ...(userPageCrudConfig.rowActions || []),
      {
        handler: async (record: Record<string, any>) => {
          openPasswordModal(record);
        },
        label: '重置密码',
        permission: buildApiMethodPermissions(userService, 'resetPassword'),
        reloadAfterAction: false,
        successMessage: false as const,
        visible: (record: Record<string, any>) =>
          canShowPasswordResetAction(currentUser.userInfo, record.id),
      },
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
        badgeItems: (record: Record<string, any>) =>
          getUserDataPermissionBadgeItems(record, roleRecords),
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
  };
});

async function loadRoleOptions(keyword = '') {
  const generation = scopeGeneration;
  roleOptionsLoading.value = true;

  try {
    const options = await roleOptionsLoader(keyword);
    if (generation !== scopeGeneration) return;
    roleOptions.value = options.map((option) => ({
      label: String(option.label),
      value: String(option.value),
    }));
  } finally {
    if (generation === scopeGeneration) roleOptionsLoading.value = false;
  }
}

async function openRoleModal(record: Record<string, any>) {
  roleFormState.id = String(record.id || '');
  roleFormState.roleList = Array.isArray(record.roleList)
    ? record.roleList.map(String)
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
  const generation = scopeGeneration;

  try {
    await scopedUserService.assignRoles({
      id: roleFormState.id,
      roleList: roleFormState.roleList,
    });
    if (generation !== scopeGeneration) return;
    message.success('角色已分配');
    roleModalOpen.value = false;
    pageKey.value += 1;
  } finally {
    if (generation === scopeGeneration) roleSubmitting.value = false;
  }
}

function clearPasswordForm() {
  passwordModalOpen.value = false;
  passwordTarget.value = null;
  passwordFormState.newPassword = '';
  passwordFormState.confirmPassword = '';
}

function openPasswordModal(record: Record<string, any>) {
  // 每次打开都清空凭据，列表记录只保留目标 ID 和展示名称。
  clearPasswordForm();
  passwordTarget.value = {
    id: String(record.id),
    name: String(record.name || record.loginName || record.id),
  };
  passwordModalOpen.value = true;
}

function cancelPasswordModal() {
  if (passwordSubmitting.value) return;
  if (passwordFormState.newPassword || passwordFormState.confirmPassword) {
    Modal.confirm({
      title: '放弃未保存的密码？',
      onOk: clearPasswordForm,
    });
    return;
  }
  clearPasswordForm();
}

async function submitPasswordForm() {
  const target = passwordTarget.value;
  if (!target) return;
  if (
    passwordFormState.newPassword.length > 128 ||
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(passwordFormState.newPassword)
  ) {
    message.warning('密码须为6至128位，并包含数字和大小写字母');
    return;
  }
  if (passwordFormState.newPassword !== passwordFormState.confirmPassword) {
    message.warning('两次输入的密码不一致');
    return;
  }

  // 只向专用接口发送目标 ID 和新密码；失败时保留草稿供用户修正。
  passwordSubmitting.value = true;
  const generation = scopeGeneration;
  try {
    await scopedUserService.resetPassword({
      id: target.id,
      newPassword: passwordFormState.newPassword,
    });
    if (generation !== scopeGeneration) return;
    clearPasswordForm();
    message.success('密码已重置，目标用户须重新登录');
    pageKey.value += 1;
  } finally {
    if (generation === scopeGeneration) passwordSubmitting.value = false;
  }
}

function handleSaved() {
  void refreshRolePermissionRecords(true);
  pageKey.value += 1;
}

function changeOrganization(
  value: undefined | UserOrgSelectorRecord | UserOrgSelectorRecord[],
  reset = false,
) {
  const record = Array.isArray(value) ? value[0] : value;
  if (record && (record.kind !== 'org' || !record.tenantId)) {
    message.error('请选择带有租户归属的已授权组织。');
    return;
  }
  if (
    !reset &&
    record?.id === selectedOrg.value?.id &&
    record?.tenantId === selectedOrg.value?.tenantId
  )
    return;
  // 切换组织重新挂载CRUD及其流程抽屉，不保留旧记录表单或旧异步响应。
  scopeGeneration++;
  selectedRecord.value = null;
  dialogOpen.value = false;
  roleModalOpen.value = false;
  roleSubmitting.value = false;
  roleOptionsLoading.value = false;
  roleOptions.value = [];
  clearPasswordForm();
  passwordSubmitting.value = false;
  selectedOrg.value = record;
}
const loadAuthorizedOrganizations = () =>
  rbacService.fetchAuthorizedOrgTree({ assembleTree: true });
watch(
  () => JSON.stringify(currentUser.userInfo),
  () => changeOrganization(undefined, true),
  { flush: 'sync' },
);

watch(dialogOpen, (open) => {
  if (!open) {
    selectedRecord.value = null;
  }
});
</script>

<template>
  <CrudPage :key="scopeKey" :config="userListConfig">
    <template #search-field-orgId>
      <UserOrgSelector
        :model-value="selectedOrg"
        :selectable-types="['org']"
        :multiple="false"
        value-mode="record"
        :load-org-tree="loadAuthorizedOrganizations"
        placeholder="当前默认组织，可选择一个已授权组织"
        class="w-full"
        @update:selected-records="changeOrganization"
      />
    </template>
  </CrudPage>

  <DataPermissionDialog
    v-if="selectedRecord"
    v-model:open="dialogOpen"
    :record="selectedRecord"
    :role-records="permissionRoleRecords"
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

  <Modal
    :open="passwordModalOpen"
    :confirm-loading="passwordSubmitting"
    :mask-closable="false"
    :title="`重置密码：${passwordTarget?.name || ''}`"
    :width="480"
    ok-text="重置密码"
    @cancel="cancelPasswordModal"
    @ok="submitPasswordForm"
  >
    <!-- 密码只保存在当前弹窗草稿中，关闭或成功后立即清空。 -->
    <div class="space-y-4">
      <div>
        <label class="mb-1 block" for="managed-user-new-password">新密码</label>
        <Input.Password
          id="managed-user-new-password"
          v-model:value="passwordFormState.newPassword"
          :maxlength="128"
          autocomplete="new-password"
          placeholder="至少6位，包含数字和大小写字母"
        />
      </div>
      <div>
        <label class="mb-1 block" for="confirm-password">确认密码</label>
        <Input.Password
          id="confirm-password"
          v-model:value="passwordFormState.confirmPassword"
          :maxlength="128"
          autocomplete="new-password"
        />
      </div>
    </div>
  </Modal>
</template>
