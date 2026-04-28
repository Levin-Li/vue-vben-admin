<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { servicePluginPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="servicePluginPageCrudConfig" />
</template>
