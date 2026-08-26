<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Select } from 'ant-design-vue';

import CrudPage from '../crud-page.vue';
import { partnerPageCrudConfig, partnerTypeOptionsLoader } from './config';

const typeOptions = ref<Array<{ label: string; value: string }>>([]);

const customerTypes = new Set([
  'GeneralCustomer', 'Dealer', 'Agent', 'Distributor',
  'OnlineFlagshipStore', 'OnlineDirectStore', 'OnlinePartnerStore', 'OnlineExclusiveStore',
  'OfflineFlagshipStore', 'OfflineDirectStore', 'OfflinePartnerStore', 'OfflineExclusiveStore',
]);

onMounted(async () => {
  typeOptions.value = await partnerTypeOptionsLoader();
});

function getAvailableTypeOptions(category?: string) {
  if (category === 'Customer') {
    return typeOptions.value.filter((item) => customerTypes.has(item.value));
  }
  if (category === 'Supplier') {
    return typeOptions.value.filter((item) => !customerTypes.has(item.value));
  }
  return typeOptions.value;
}

function updateCategory(formState: Record<string, any>, category?: string) {
  formState.category = category;
  if (!getAvailableTypeOptions(category).some((item) => item.value === formState.type)) {
    formState.type = undefined;
  }
}
</script>

<template>
  <CrudPage :config="partnerPageCrudConfig">
    <template #form-field-category="{ formState }">
      <Select
        :options="[
          { label: '客户', value: 'Customer' },
          { label: '供应商', value: 'Supplier' },
        ]"
        :value="formState.category"
        class="w-full"
        @update:value="(value) => updateCategory(formState, value)"
      />
    </template>
    <template #form-field-type="{ formState }">
      <Select
        v-model:value="formState.type"
        :options="getAvailableTypeOptions(formState.category)"
        class="w-full"
      />
    </template>
  </CrudPage>
</template>
