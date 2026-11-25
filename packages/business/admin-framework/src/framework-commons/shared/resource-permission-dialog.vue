<script lang="ts" setup>
import type {
  PermissionTreeNode,
  RbacMenuNode,
  RbacModuleNode,
} from './data-permission-types';
import type {
  ResourcePermissionLoadedTarget,
  ResourcePermissionLoadTarget,
  ResourcePermissionSaveTarget,
} from './resource-permission-types';

import { computed, ref, watch } from 'vue';

import { Alert, message, Modal, Spin } from 'ant-design-vue';

import { rbacService } from '../app/api/rbac-service';
import { parseApiScopedGrant } from './api-scoped-grant';
import {
  collectKnownPermissionTreeValues,
  collectKnownPermissionValues,
  collectPermissionValues,
  mergeUnmappedPermissions,
  splitMappedAndUnmappedPermissions,
} from './data-permission-transform';
import ResourcePermissionTreeEditor from './resource-permission-tree-editor.vue';

const props = withDefaults(
  defineProps<{
    loadTarget: ResourcePermissionLoadTarget;
    open: boolean;
    saveTarget: ResourcePermissionSaveTarget;
    autoIncludeMenuAncestors?: (menuPath: string) => boolean;
    subjectLabel?: string;
    title?: string;
  }>(),
  {
    subjectLabel: '主体',
    title: '资源权限分配',
  },
);

const emit = defineEmits<{
  saved: [];
  'update:open': [boolean];
}>();

const detail = ref<null | ResourcePermissionLoadedTarget>(null);
const errorMessage = ref('');
const loading = ref(false);
const modules = ref<RbacModuleNode[]>([]);
const menuTree = ref<RbacMenuNode[]>([]);
const permissionTree = ref<PermissionTreeNode[]>([]);
const saving = ref(false);
const selectedPermissions = ref<string[]>([]);
const unmappedPermissions = ref<string[]>([]);

const summaryText = computed(() => {
  if (!detail.value) {
    return '';
  }

  return [detail.value.name, detail.value.code].filter(Boolean).join(' / ');
});

const dialogTitle = computed(() => props.title);

const saveDisabled = computed(
  () => loading.value || saving.value || !detail.value?.id,
);

const knownPermissionValues = computed(() => {
  const treeValues = collectKnownPermissionTreeValues(permissionTree.value);
  return treeValues.size > 0
    ? treeValues
    : collectKnownPermissionValues(modules.value);
});

function closeDialog() {
  emit('update:open', false);
}

async function loadData() {
  if (!props.open) {
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    const [detailResp, permissionTreeResp, modulesResp, menuTreeResp] =
      await Promise.all([
        props.loadTarget(),
        rbacService.fetchAuthorizedPermissionTree(),
        rbacService.fetchAuthorizedResourceModules(),
        rbacService.getAuthorizedMenuList(),
      ]);

    detail.value = detailResp;
    permissionTree.value = (permissionTreeResp || []) as PermissionTreeNode[];
    modules.value = (modulesResp || []) as RbacModuleNode[];
    menuTree.value = (menuTreeResp || []) as RbacMenuNode[];

    const permissionState = splitMappedAndUnmappedPermissions(
      detailResp.permissions || [],
      modules.value,
      permissionTree.value,
    );
    selectedPermissions.value = permissionState.mapped;
    unmappedPermissions.value = permissionState.unmapped;
  } catch (error) {
    console.error(error);
    errorMessage.value = '加载资源权限信息失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!detail.value?.id) {
    return;
  }

  const selected = collectPermissionValues(selectedPermissions.value);
  const invalidPermissions = selected.filter((permission) => {
    if (!permission) return true;
    if (knownPermissionValues.value.has(permission)) return false;
    try {
      const grant = parseApiScopedGrant(permission);
      return !grant || !knownPermissionValues.value.has(grant.operation);
    } catch {
      return true;
    }
  });

  if (invalidPermissions.length > 0) {
    errorMessage.value = `存在无效权限表达式，未提交保存：${invalidPermissions.join('、')}`;
    return;
  }

  saving.value = true;

  try {
    // 历史未知许可只原样保留，当前界面不得在加载和保存之间静默抹除。
    const permissions = mergeUnmappedPermissions(
      selected,
      unmappedPermissions.value,
    );
    const changes = {
      id: detail.value.id,
      permissions,
      ...(detail.value.optimisticLock === undefined
        ? {}
        : { optimisticLock: detail.value.optimisticLock }),
    };
    await props.saveTarget(changes);
    message.success('资源权限保存成功');
    emit('saved');
    closeDialog();
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      loadData();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <Modal
    :confirm-loading="saving"
    :mask-closable="false"
    :ok-button-props="{ disabled: saveDisabled }"
    :open="open"
    :title="dialogTitle"
    :style="{ maxWidth: 'none' }"
    width="max(1080px, 85vw)"
    destroy-on-close
    @cancel="closeDialog"
    @ok="handleSave"
  >
    <div class="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto pr-2">
      <div class="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {{ summaryText || `正在加载${subjectLabel}信息...` }}
      </div>

      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        show-icon
        type="error"
      />

      <Spin :spinning="loading">
        <ResourcePermissionTreeEditor
          v-model:value="selectedPermissions"
          :menu-tree="menuTree"
          :modules="modules"
          :permission-tree="permissionTree"
          :auto-include-menu-ancestors="autoIncludeMenuAncestors"
        />
      </Spin>
    </div>
  </Modal>
</template>
