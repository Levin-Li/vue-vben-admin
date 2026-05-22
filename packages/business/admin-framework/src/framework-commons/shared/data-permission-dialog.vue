<script lang="ts" setup>
import type {
  DataPermissionPreviewPayload,
  DataPermissionSubjectType,
  OrgScopeDraft,
  OrgTreeNode,
} from './data-permission-types';

import { computed, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import { Alert, message, Modal, Spin } from 'ant-design-vue';

import { rbacService } from '../app/api/rbac-service';
import { requestClient } from '../runtime';
import {
  buildOrgScopeDraftsFromValue,
  DEFAULT_TENANT_MATCHING_EXPRESSION,
} from './data-permission-transform';
import { tenantOptionsLoader } from './config-helpers';
import OrgScopeEditor from './org-scope-editor.vue';
import { isSuperAdminUser } from './user-identity';

const props = defineProps<{
  open: boolean;
  previewPayload?: DataPermissionPreviewPayload;
  record: null | Record<string, any>;
  subjectType: DataPermissionSubjectType;
}>();

const emit = defineEmits<{
  saved: [];
  'update:open': [boolean];
}>();

const detail = ref<null | Record<string, any>>(null);
const errorMessage = ref('');
const loading = ref(false);
const orgScopeDrafts = ref<OrgScopeDraft[]>([]);
const orgTree = ref<OrgTreeNode[]>([]);
const saving = ref(false);
const userStore = useUserStore();

const isRole = computed(() => props.subjectType === 'role');
const apiBase = computed(() => (isRole.value ? '/Role' : '/User'));
const modalTitle = computed(() =>
  isRole.value ? '角色数据权限分配' : '用户数据权限分配',
);
const expressionTypes = computed(
  () =>
    props.previewPayload?.expressionTypes || [
      'IdPath',
      'NamePath',
      'Groovy',
      'SpringEL',
    ],
);
const isSuperAdmin = computed(() => isSuperAdminUser(userStore.userInfo));
const summaryText = computed(() => {
  if (!detail.value) {
    return '';
  }

  return [
    detail.value.name,
    detail.value.code || detail.value.loginName,
    detail.value.org?.name || detail.value.orgName,
  ]
    .filter(Boolean)
    .join(' / ');
});

const invalidOrgScopeCount = computed(
  () =>
    orgScopeDrafts.value.filter(
      (item) => !item.orgScopeExpressionType || !item.orgScopeExpression,
    ).length,
);

const saveDisabled = computed(
  () =>
    loading.value ||
    saving.value ||
    !detail.value?.id ||
    invalidOrgScopeCount.value > 0,
);

function closeDialog() {
  emit('update:open', false);
}

function setDetailState(nextDetail: Record<string, any>) {
  detail.value = nextDetail;
  orgScopeDrafts.value = buildOrgScopeDraftsFromValue(
    nextDetail.orgScopeList || [],
  );
}

async function loadData() {
  if (!props.open) {
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    if (props.previewPayload) {
      setDetailState(props.previewPayload.detail);
      orgTree.value = props.previewPayload.orgTree;

      return;
    }

    if (!props.record?.id) {
      return;
    }

    const [detailResp, orgTreeResp] = await Promise.all([
      requestClient.get<Record<string, any>>(`${apiBase.value}/retrieve`, {
        params: {
          id: props.record.id,
        },
      }),
      rbacService.fetchAuthorizedOrgTree(),
    ]);

    setDetailState(detailResp);
    orgTree.value = (orgTreeResp || []) as OrgTreeNode[];
  } catch (error) {
    console.error(error);
    errorMessage.value = '加载数据权限信息失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!detail.value?.id) {
    return;
  }

  if (invalidOrgScopeCount.value > 0) {
    message.warning('请先完善组织范围中的表达式类型和表达式内容');
    return;
  }

  saving.value = true;

  try {
    if (props.previewPayload) {
      message.success('预览模式下已模拟保存');
      emit('saved');
      closeDialog();
      return;
    }

    const payload: Record<string, any> = {
      forceUpdateFields: ['orgScopeList'],
      id: detail.value.id,
      optimisticLock: detail.value.optimisticLock,
      orgScopeList: orgScopeDrafts.value.map(
        ({
          isAllow,
          orgId,
          orgScopeExpression,
          orgScopeExpressionType,
          tenantMatchingExpression,
        }) => ({
          isAllow,
          orgId,
          orgScopeExpression,
          orgScopeExpressionType,
          tenantMatchingExpression: isSuperAdmin.value
            ? tenantMatchingExpression || DEFAULT_TENANT_MATCHING_EXPRESSION
            : DEFAULT_TENANT_MATCHING_EXPRESSION,
        }),
      ),
    };

    await requestClient.put(`${apiBase.value}/update`, payload);
    message.success('数据权限保存成功');
    emit('saved');
    closeDialog();
  } finally {
    saving.value = false;
  }
}

watch(
  () => [props.open, props.record?.id, props.subjectType] as const,
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
    :open="open"
    :ok-button-props="{ disabled: saveDisabled }"
    :title="modalTitle"
    :width="1080"
    destroy-on-close
    @cancel="closeDialog"
    @ok="handleSave"
  >
    <div class="space-y-4">
      <div class="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {{ summaryText || '正在加载主体信息...' }}
      </div>

      <Alert
        v-if="invalidOrgScopeCount > 0"
        :message="`还有 ${invalidOrgScopeCount} 条组织范围规则未填写完整，保存前请先补齐。`"
        show-icon
        type="warning"
      />

      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        show-icon
        type="error"
      />

      <Spin :spinning="loading">
        <OrgScopeEditor
          v-model:value="orgScopeDrafts"
          :allow-script-expression-types="isSuperAdmin"
          :expression-types="expressionTypes"
          :load-tenant-options="tenantOptionsLoader"
          :org-tree="orgTree"
          :show-tenant-matching-expression="true"
        />
      </Spin>
    </div>
  </Modal>
</template>
