<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { payChannelPageCrudConfig } from './config';
import PayChannelDetailInfoField from './pay-channel-detail-info-field.vue';
import PayWayItemListManager from './pay-way-item-list-manager.vue';
</script>

<template>
  <CrudPage :config="payChannelPageCrudConfig">
    <template #form-field-providerCode="{ formState }">
      <PayChannelDetailInfoField :form-state="formState" mode="provider" />
    </template>
    <template #form-field-payWayItemList="{ formState }">
      <PayWayItemListManager
        :items="formState.payWayItemList"
        @update:items="formState.payWayItemList = $event"
      />
    </template>
    <template #form-field-detailInfo="{ formState }">
      <PayChannelDetailInfoField :form-state="formState" mode="detail" />
    </template>
  </CrudPage>
</template>
