<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { jobPostPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="jobPostPageCrudConfig" />
</template>
