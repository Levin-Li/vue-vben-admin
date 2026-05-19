<script lang="ts" setup>
import SettingCrudPage from '../setting-crud-page.vue';
import { userSettingPageCrudConfig } from './config';
</script>

<template>
  <SettingCrudPage :config="userSettingPageCrudConfig" />
</template>
