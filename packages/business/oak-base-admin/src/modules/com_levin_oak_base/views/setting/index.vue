<script lang="ts" setup>
import SettingCrudPage from '../setting-crud-page.vue';
import { settingPageCrudConfig } from './config';
</script>

<template>
  <SettingCrudPage :config="settingPageCrudConfig" />
</template>
