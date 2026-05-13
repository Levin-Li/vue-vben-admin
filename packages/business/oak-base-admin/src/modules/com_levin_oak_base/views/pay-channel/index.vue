<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { payChannelPageCrudConfig } from './config';
import PayWayItemListManager from './pay-way-item-list-manager.vue';
</script>

<template>
  <CrudPage :config="payChannelPageCrudConfig">
    <template #form-field-payWayItemList="{ formState }">
      <PayWayItemListManager
        :items="formState.payWayItemList"
        @update:items="formState.payWayItemList = $event"
      />
    </template>
  </CrudPage>
</template>
