<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { appClientPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="appClientPageCrudConfig" />
</template>
