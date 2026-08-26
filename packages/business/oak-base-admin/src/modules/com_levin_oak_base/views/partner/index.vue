<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { partnerPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="partnerPageCrudConfig" />
</template>
