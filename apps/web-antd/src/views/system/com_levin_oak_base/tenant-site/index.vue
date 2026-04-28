<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { tenantSitePageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="tenantSitePageCrudConfig" />
</template>
