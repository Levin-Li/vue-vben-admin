<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { bankBranchPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="bankBranchPageCrudConfig" />
</template>
