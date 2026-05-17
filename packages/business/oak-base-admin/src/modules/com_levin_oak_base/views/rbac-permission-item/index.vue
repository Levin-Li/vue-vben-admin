<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { rbacPermissionItemPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="rbacPermissionItemPageCrudConfig" />
</template>
