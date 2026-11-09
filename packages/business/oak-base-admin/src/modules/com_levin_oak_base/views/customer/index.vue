<script lang="ts" setup>
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { computed, ref } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import {
  Button,
  Empty,
  Modal,
  Select,
  Timeline,
  TimelineItem,
} from 'ant-design-vue';

import { customerService } from '../../api/customer-service';
import { createModeFields } from '../create-mode-fields';
import CrudPage from '../crud-page.vue';
import { partnerCertificationActions } from '../partner/certification-actions';
import {
  buildPartnerCertificationLog,
  buildPartnerCertificationLogAction,
} from '../partner/certification-log';
import { isLegalSubjectPickerLocked } from '../partner/legal-subject-edit-lock';
import LegalSubjectPicker from '../partner/legal-subject-picker.vue';
import QuickAdd from '../partner/quick-add.vue';
import ChannelPartnerPicker from './channel-partner-picker.vue';
import { customerPageCrudConfig } from './config';

const userStore = useUserStore();
const { hasPermission } = useRbacAccess();
const requireTenant = computed(() => isPlatformUser(userStore.userInfo));
const mineMode = ref(false);
const logOpen = ref(false);
const logItems = ref<ReturnType<typeof buildPartnerCertificationLog>>([]);

// 两种普通新增使用同一表单，但服务端写入的参与方不同。
function openCreateMode(mine: boolean, openCreate: () => void) {
  mineMode.value = mine;
  openCreate();
}

// 客户复用伙伴认证事件与流程日志，普通编辑不直接提交状态。
const pageConfig = computed<CrudPageConfig>(() => ({
  ...customerPageCrudConfig,
  createButtonVisible: false,
  createPath: () =>
    mineMode.value ? '/Customer/saveMyCustomer' : '/Customer/saveCustomer',
  fields: createModeFields(customerPageCrudConfig.fields, mineMode.value),
  listOperations: [
    ...(customerPageCrudConfig.listOperations || []),
    { key: 'Customer:createMine', label: '新增我的客户', placement: 'left' },
    { key: 'Customer:createBusiness', label: '新增', placement: 'left' },
  ],
  rowActions: [
    ...(customerPageCrudConfig.rowActions || []),
    ...partnerCertificationActions,
    buildPartnerCertificationLogAction(customerService, (logs) => {
      logItems.value = logs;
      logOpen.value = true;
    }),
  ],
}));

function updateType(formState: Record<string, any>, type?: unknown) {
  formState.type = type;
  formState.channelPartnerId = undefined;
}
</script>

<template>
  <CrudPage :config="pageConfig">
    <template
      #toolbar-before-create="{ loadList, isListOperationVisible, openCreate }"
    >
      <QuickAdd
        target="Customer"
        :load-list="loadList"
        :visible="isListOperationVisible('customer:quickAdd')"
      />
      <Button
        v-if="
          isListOperationVisible('Customer:createMine') &&
          hasPermission(
            buildApiMethodPermissions(customerService, 'createMine'),
          )
        "
        type="primary"
        @click="openCreateMode(true, openCreate)"
        >新增我的客户</Button
      >
      <Button
        v-if="
          isListOperationVisible('Customer:createBusiness') &&
          hasPermission(buildApiMethodPermissions(customerService, 'create'))
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
    <template #form-field-type="{ disabled, formState }">
      <Select
        :disabled="disabled"
        :options="[
          { label: '直接客户', value: 'DirectCustomer' },
          { label: '渠道客户', value: 'ChannelCustomer' },
        ]"
        :value="formState.type"
        class="w-full"
        @update:value="(value) => !disabled && updateType(formState, value)"
      />
    </template>
    <template #form-field-channelPartnerId="{ disabled, formState }">
      <ChannelPartnerPicker
        v-if="formState.type === 'ChannelCustomer'"
        v-model="formState.channelPartnerId"
        :disabled="disabled"
        :tenant-id="formState.tenantId"
        :require-tenant="requireTenant"
      />
      <span v-else class="customer-channel-field-hidden"></span>
    </template>
  </CrudPage>

  <!-- 客户认证日志按服务端记录的时间顺序展示。 -->
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

<style scoped>
/* 直接客户不展示渠道关系整行；字段仍保留在 CRUD 校验和提交配置中。 */
:deep(
  [data-crud-form-field='channelPartnerId']:has(.customer-channel-field-hidden)
) {
  display: none;
}
</style>
