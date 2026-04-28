<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { customerPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="customerPageCrudConfig" />
</template>
