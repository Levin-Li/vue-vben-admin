<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { importExportTemplatePageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="importExportTemplatePageCrudConfig" />
</template>
