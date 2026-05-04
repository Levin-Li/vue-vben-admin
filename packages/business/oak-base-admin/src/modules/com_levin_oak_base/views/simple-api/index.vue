<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { simpleApiPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="simpleApiPageCrudConfig" />
</template>
