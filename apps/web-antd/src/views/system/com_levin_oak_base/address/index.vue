<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { addressPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="addressPageCrudConfig" />
</template>
