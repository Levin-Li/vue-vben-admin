<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { noticePageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="noticePageCrudConfig" />
</template>
