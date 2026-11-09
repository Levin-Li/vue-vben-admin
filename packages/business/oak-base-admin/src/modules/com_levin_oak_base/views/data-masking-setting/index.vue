<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { dataMaskingSettingPageCrudConfig } from './config';
import RuleEditor from './rule-editor.vue';
</script>

<template>
  <CrudPage :config="dataMaskingSettingPageCrudConfig">
    <template #form-field-valueContent="{ formState }">
      <RuleEditor :form-state="formState" />
    </template>
  </CrudPage>
</template>
