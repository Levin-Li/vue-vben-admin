<script lang="ts" setup>
import type { RbacModuleNode } from './data-permission-types';

import { computed, ref, watch } from 'vue';

import { Alert, message, Modal, Spin } from 'ant-design-vue';

import { fetchAuthorizedResourceModules } from '../../../api/rbac';
import { requestClient } from '../../../api/request';
import {
  collectPermissionValues,
  splitMappedAndUnmappedPermissions,
} from './data-permission-transform';
import ResourcePermissionTreeEditor from './resource-permission-tree-editor.vue';

const props = withDefaults(
  defineProps<{
    apiBase?: string;
    open: boolean;
    permissionField?: string;
    record: null | Record<string, any>;
    subjectLabel?: string;
    title?: string;
  }>(),
  {
    apiBase: '/Role',
    permissionField: 'permissionList',
    subjectLabel: '主体',
    title: '资源权限分配',
  },
);

const emit = defineEmits<{
  saved: [];
  'update:open': [boolean];
}>();

const detail = ref<null | Record<string, any>>(null);
const errorMessage = ref('');
const loading = ref(false);
const modules = ref<RbacModuleNode[]>([]);
const saving = ref(false);
const selectedPermissions = ref<string[]>([]);

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

function closeDialog() {
  emit('update:open', false);
}

async function loadData() {
  if (!props.open || !props.record?.id) {
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    const [detailResp, modulesResp] = await Promise.all([
      requestClient.get<Record<string, any>>(`${props.apiBase}/retrieve`, {
        params: {
          id: props.record.id,
        },
      }),
      fetchAuthorizedResourceModules(),
    ]);

    detail.value = detailResp;
    modules.value = (modulesResp || []) as RbacModuleNode[];

    const permissionState = splitMappedAndUnmappedPermissions(
      detailResp[props.permissionField] || [],
      modules.value,
    );
    selectedPermissions.value = permissionState.mapped;
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

  saving.value = true;

  try {
    const payload: Record<string, any> = {
      forceUpdateFields: [props.permissionField],
      id: detail.value.id,
      [props.permissionField]: collectPermissionValues(
        selectedPermissions.value,
      ),
    };

    if (detail.value.optimisticLock !== undefined) {
      payload.optimisticLock = detail.value.optimisticLock;
    }

    await requestClient.put(`${props.apiBase}/update`, payload);
    message.success('资源权限保存成功');
    emit('saved');
    closeDialog();
  } finally {
    saving.value = false;
  }
}

watch(
  () => [props.open, props.record?.id] as const,
  ([open]) => {
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
    :ok-button-props="{ disabled: saveDisabled }"
    :open="open"
    :title="dialogTitle"
    :width="1080"
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
          :modules="modules"
        />
      </Spin>
    </div>
  </Modal>
</template>
