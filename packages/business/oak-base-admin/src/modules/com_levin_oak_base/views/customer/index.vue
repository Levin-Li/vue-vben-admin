<script lang="ts" setup>
import { Select } from 'ant-design-vue';

import CrudPage from '../crud-page.vue';
import { isLegalSubjectPickerLocked } from '../partner/legal-subject-edit-lock';
import LegalSubjectPicker from '../partner/legal-subject-picker.vue';
import ChannelPartnerPicker from './channel-partner-picker.vue';
import { customerPageCrudConfig } from './config';

function updateType(formState: Record<string, any>, type?: unknown) {
  formState.type = type;
  formState.channelPartnerId = undefined;
}
</script>

<template>
  <CrudPage :config="customerPageCrudConfig">
    <template
      #form-field-legalSubjectId="{ disabled, editingRecord, formState }"
    >
      <LegalSubjectPicker
        v-model="formState.legalSubjectId"
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
      />
      <span v-else class="customer-channel-field-hidden"></span>
    </template>
  </CrudPage>
</template>

<style scoped>
/* 直接客户不展示渠道关系整行；字段仍保留在 CRUD 校验和提交配置中。 */
:deep(
  [data-crud-form-field='channelPartnerId']:has(.customer-channel-field-hidden)
) {
  display: none;
}
</style>
