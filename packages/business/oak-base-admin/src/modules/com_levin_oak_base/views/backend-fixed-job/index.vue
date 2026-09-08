<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { backendFixedJobPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="backendFixedJobPageCrudConfig" />
</template>
