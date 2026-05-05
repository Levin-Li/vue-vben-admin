<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { tenantPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="tenantPageCrudConfig" />
</template>
