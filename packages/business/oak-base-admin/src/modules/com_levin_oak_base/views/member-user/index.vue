<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { memberUserPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="memberUserPageCrudConfig" />
</template>
