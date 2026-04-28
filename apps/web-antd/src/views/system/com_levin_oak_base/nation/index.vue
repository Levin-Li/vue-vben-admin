<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { nationPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="nationPageCrudConfig" />
</template>
