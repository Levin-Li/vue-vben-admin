<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Select } from 'ant-design-vue';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { partnerService } from '../../api/partner-service';
import CrudPage from '../crud-page.vue';
import { partnerPageCrudConfig, partnerTypeOptionsLoader } from './config';

type PartnerSubCategoryOption = {
  label: string;
  value: number | string;
};

type PartnerRecord = Record<string, any>;

const subCategoryOptions = ref<PartnerSubCategoryOption[]>([]);

const customerSubCategories = new Set(['DirectCustomer', 'ChannelCustomer']);
const channelSubCategories = new Set([
  'Dealer', 'Agent', 'Distributor',
  'OnlineFlagshipStore', 'OnlineDirectStore', 'OnlinePartnerStore', 'OnlineExclusiveStore',
  'OfflineFlagshipStore', 'OfflineDirectStore', 'OfflinePartnerStore', 'OfflineExclusiveStore',
]);

onMounted(async () => {
  subCategoryOptions.value = (await partnerTypeOptionsLoader()).flatMap((option) => (
    typeof option.value === 'string' || typeof option.value === 'number'
      ? [{ label: option.label, value: option.value }]
      : []
  ));
});

function isInSubCategoryGroup(option: PartnerSubCategoryOption, types: Set<string>) {
  return typeof option.value === 'string' && types.has(option.value);
}

function getAvailableSubCategoryOptions(category?: unknown) {
  if (category === 'Customer') {
    return subCategoryOptions.value.filter((item) => isInSubCategoryGroup(item, customerSubCategories));
  }
  if (category === 'Channel') {
    return subCategoryOptions.value.filter((item) => isInSubCategoryGroup(item, channelSubCategories));
  }
  if (category === 'SupplyChain') {
    return subCategoryOptions.value.filter(
      (item) => !isInSubCategoryGroup(item, customerSubCategories) && !isInSubCategoryGroup(item, channelSubCategories),
    );
  }
  return subCategoryOptions.value;
}

function updateCategory(formState: Record<string, any>, category?: unknown) {
  formState.category = category;
  if (!getAvailableSubCategoryOptions(category).some((item) => item.value === formState.subCategory)) {
    formState.subCategory = undefined;
  }
}

const pageConfig = computed(() => ({
  ...partnerPageCrudConfig,
  rowActions: [
    {
      handler: (record: PartnerRecord) => partnerService.submitCertification(buildCertificationActionPayload(record)),
      label: '提交认证',
      permission: buildApiMethodPermissions(partnerService, 'submitCertification'),
      visible: (record: PartnerRecord) => canFireCertificationEvent(record, '提交认证'),
    },
    {
      handler: (record: PartnerRecord) => partnerService.approveCertification(buildCertificationActionPayload(record)),
      label: '认证通过',
      permission: buildApiMethodPermissions(partnerService, 'approveCertification'),
      visible: (record: PartnerRecord) => canFireCertificationEvent(record, '认证通过'),
    },
    {
      handler: (record: PartnerRecord) => partnerService.rejectCertification(buildCertificationActionPayload(record)),
      label: '认证拒绝',
      permission: buildApiMethodPermissions(partnerService, 'rejectCertification'),
      visible: (record: PartnerRecord) => canFireCertificationEvent(record, '认证拒绝'),
    },
    {
      handler: (record: PartnerRecord) => partnerService.revokeCertification(buildCertificationActionPayload(record)),
      label: '撤销认证',
      permission: buildApiMethodPermissions(partnerService, 'revokeCertification'),
      visible: (record: PartnerRecord) => canFireCertificationEvent(record, '撤销认证'),
    },
  ],
}));

function canFireCertificationEvent(record: PartnerRecord, event: string) {
  return Array.isArray(record.supportCertificationEventsByCurrentStatus)
    && record.supportCertificationEventsByCurrentStatus.includes(event);
}

function buildCertificationActionPayload(record: PartnerRecord) {
  return {
    id: record.id,
    _operatorAction: record._operatorAction,
    optimisticLock: record.optimisticLock,
    orgId: record.orgId,
    ownerId: record.ownerId,
    tenantId: record.tenantId,
  };
}
</script>

<template>
  <CrudPage :config="pageConfig">
    <template #form-field-category="{ formState }">
      <Select
        :options="[
          { label: '供应链', value: 'SupplyChain' },
          { label: '渠道', value: 'Channel' },
          { label: '客户', value: 'Customer' },
        ]"
        :value="formState.category"
        class="w-full"
        @update:value="(value) => updateCategory(formState, value)"
      />
    </template>
    <template #form-field-subCategory="{ formState }">
      <Select
        v-model:value="formState.subCategory"
        :options="getAvailableSubCategoryOptions(formState.category)"
        class="w-full"
      />
    </template>
  </CrudPage>
</template>
