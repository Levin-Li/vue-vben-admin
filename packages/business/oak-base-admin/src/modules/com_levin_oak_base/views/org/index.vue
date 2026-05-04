<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { orgPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="orgPageCrudConfig" />
</template>
