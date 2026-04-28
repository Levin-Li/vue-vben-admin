<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { settingPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="settingPageCrudConfig" />
</template>
