<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import SettingValueContentField from '../setting-value-content-field.vue';

import { globalOrgSelectorSettingPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="globalOrgSelectorSettingPageCrudConfig">
    <template #form-field-valueContent="{ formState }">
      <SettingValueContentField :form-state="formState" inline />
    </template>
  </CrudPage>
</template>
