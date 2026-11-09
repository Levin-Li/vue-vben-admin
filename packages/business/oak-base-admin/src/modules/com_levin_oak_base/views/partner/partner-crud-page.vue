<script lang="ts" setup>
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import type { QuickAddTarget } from '../../api/quick-partner-onboarding';

import { computed, ref } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { Button, Empty, Modal, Timeline, TimelineItem } from 'ant-design-vue';

import CrudPage from '../crud-page.vue';
import { createModeFields } from '../create-mode-fields';
import { partnerCertificationActions } from './certification-actions';
import {
  buildPartnerCertificationLog,
  buildPartnerCertificationLogAction,
} from './certification-log';
import { isLegalSubjectPickerLocked } from './legal-subject-edit-lock';
import LegalSubjectPicker from './legal-subject-picker.vue';
import QuickAdd from './quick-add.vue';

const props = defineProps<{
  config: CrudPageConfig;
  quickTarget?: QuickAddTarget;
}>();
const userStore = useUserStore();
const { hasPermission } = useRbacAccess();
const requireTenant = computed(() => isPlatformUser(userStore.userInfo));
const mineMode = ref(false);
const logOpen = ref(false);
const logItems = ref<ReturnType<typeof buildPartnerCertificationLog>>([]);

// 普通建档只选择商务对接方；“新增我的”主体方由服务端确认。
function openCreateMode(mine: boolean, openCreate: () => void) {
  mineMode.value = mine;
  openCreate();
}

// 两类伙伴页面保留独立配置，共用认证事件与日志的局部交互。
const pageConfig = computed<CrudPageConfig>(() => ({
  ...props.config,
  createButtonVisible: false,
  createPath: () =>
    mineMode.value && props.quickTarget
      ? `/${props.quickTarget}/saveMy${props.quickTarget}`
      : String(props.config.createPath),
  fields: createModeFields(props.config.fields, mineMode.value),
  listOperations: [
    ...(props.config.listOperations || []),
    ...(props.quickTarget
      ? [
          {
            key: `${props.quickTarget}:createMine`,
            label: `新增我的${props.quickTarget === 'SupplierPartner' ? '供应伙伴' : '渠道伙伴'}`,
            placement: 'left' as const,
          },
          {
            key: `${props.quickTarget}:createBusiness`,
            label: '新增',
            placement: 'left' as const,
          },
        ]
      : []),
  ],
  rowActions: [
    ...(props.config.rowActions || []),
    ...partnerCertificationActions,
    ...(props.config.apiService
      ? [
          buildPartnerCertificationLogAction(
            props.config.apiService,
            (logs) => {
              logItems.value = logs;
              logOpen.value = true;
            },
          ),
        ]
      : []),
  ],
}));
</script>

<template>
  <CrudPage :config="pageConfig">
    <template
      #toolbar-before-create="{ loadList, isListOperationVisible, openCreate }"
    >
      <QuickAdd
        v-if="quickTarget"
        :target="quickTarget"
        :load-list="loadList"
        :visible="isListOperationVisible(`${quickTarget}:quickAdd`)"
      />
      <Button
        v-if="
          quickTarget &&
          isListOperationVisible(`${quickTarget}:createMine`) &&
          hasPermission(
            buildApiMethodPermissions(config.apiService, 'createMine'),
          )
        "
        type="primary"
        @click="openCreateMode(true, openCreate)"
        >新增我的{{
          quickTarget === 'SupplierPartner' ? '供应伙伴' : '渠道伙伴'
        }}</Button
      >
      <Button
        v-if="
          quickTarget &&
          isListOperationVisible(`${quickTarget}:createBusiness`) &&
          hasPermission(buildApiMethodPermissions(config.apiService, 'create'))
        "
        type="primary"
        @click="openCreateMode(false, openCreate)"
        >新增</Button
      >
    </template>
    <template
      #form-field-legalSubjectId="{ disabled, editingRecord, formState }"
    >
      <LegalSubjectPicker
        v-model="formState.legalSubjectId"
        :tenant-id="formState.tenantId"
        :require-tenant="requireTenant"
        :disabled="isLegalSubjectPickerLocked(disabled, editingRecord)"
      />
    </template>
  </CrudPage>

  <!-- 流程日志固定按时间、操作人、状态迁移、非空备注展示。 -->
  <Modal v-model:open="logOpen" title="流程日志" :footer="null">
    <Timeline v-if="logItems.length > 0" class="pt-4">
      <TimelineItem v-for="item in logItems" :key="item.key">
        <div>{{ item.occurTime }}</div>
        <div>{{ item.operator }}</div>
        <div>{{ item.transition }}</div>
        <div v-if="item.remark">{{ item.remark }}</div>
      </TimelineItem>
    </Timeline>
    <Empty v-else description="暂无流程日志" />
  </Modal>
</template>
