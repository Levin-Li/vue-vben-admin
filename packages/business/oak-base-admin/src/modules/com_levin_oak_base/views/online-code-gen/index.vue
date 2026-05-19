<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { onlineCodeGenPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="onlineCodeGenPageCrudConfig" />
</template>
