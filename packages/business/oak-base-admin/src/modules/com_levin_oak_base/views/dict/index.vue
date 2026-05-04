<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { dictPageCrudConfig } from './config';
import DictItemManager from './dict-item-manager.vue';
</script>

<template>
  <CrudPage :config="dictPageCrudConfig">
    <template #form-field-itemList="{ formState }">
      <DictItemManager
        :items="formState.itemList"
        @update:items="formState.itemList = $event"
      />
    </template>
  </CrudPage>
</template>
