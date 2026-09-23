<script lang="ts" setup>
import { computed } from 'vue';
import CrudPage from '../crud-page.vue';
import { inboxPageCrudConfig } from './config';
const pageConfig = computed(() => ({ ...inboxPageCrudConfig, create: false, edit: false, remove: false }));
</script>
<template><CrudPage :config="pageConfig" /></template>
