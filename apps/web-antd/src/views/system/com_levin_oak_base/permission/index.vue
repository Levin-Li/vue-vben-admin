<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { permissionPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="permissionPageCrudConfig" />
</template>
