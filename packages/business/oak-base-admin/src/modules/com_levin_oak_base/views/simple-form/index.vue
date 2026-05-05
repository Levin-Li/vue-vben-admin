<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { simpleFormPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="simpleFormPageCrudConfig" />
</template>
