<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { platformDomainPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="platformDomainPageCrudConfig" />
</template>
