<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { scheduledTaskPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="scheduledTaskPageCrudConfig" />
</template>
