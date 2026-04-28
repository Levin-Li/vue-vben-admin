<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { brandPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="brandPageCrudConfig" />
</template>
