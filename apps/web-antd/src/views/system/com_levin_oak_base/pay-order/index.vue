<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { payOrderPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="payOrderPageCrudConfig" />
</template>
