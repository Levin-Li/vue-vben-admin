<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { userSettingPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="userSettingPageCrudConfig" />
</template>
