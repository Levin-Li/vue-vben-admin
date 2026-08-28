<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Select } from 'ant-design-vue';

import CrudPage from '../crud-page.vue';
import { partnerPageCrudConfig, partnerTypeOptionsLoader } from './config';

type PartnerSubCategoryOption = {
  label: string;
  value: number | string;
};

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
</script>

<template>
  <CrudPage :config="partnerPageCrudConfig">
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
