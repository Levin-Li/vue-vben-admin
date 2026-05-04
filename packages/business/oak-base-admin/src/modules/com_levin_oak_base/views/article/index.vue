<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { articlePageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="articlePageCrudConfig" />
</template>
