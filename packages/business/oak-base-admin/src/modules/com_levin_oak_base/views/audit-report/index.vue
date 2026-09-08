<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { auditReportPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="auditReportPageCrudConfig" />
</template>
