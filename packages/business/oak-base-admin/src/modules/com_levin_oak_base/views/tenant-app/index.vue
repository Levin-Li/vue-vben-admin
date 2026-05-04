<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { tenantAppPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="tenantAppPageCrudConfig" />
</template>
