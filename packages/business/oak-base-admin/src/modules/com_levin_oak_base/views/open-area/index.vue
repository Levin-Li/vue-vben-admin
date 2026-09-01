<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { openAreaPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="openAreaPageCrudConfig" />
</template>
