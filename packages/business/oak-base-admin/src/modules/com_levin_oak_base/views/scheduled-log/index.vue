<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { scheduledLogPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="scheduledLogPageCrudConfig" />
</template>
