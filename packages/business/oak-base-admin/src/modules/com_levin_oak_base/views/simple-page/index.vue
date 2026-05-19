<script lang="ts" setup>
import { simplePageService } from '../../api/simple-page-service';
import SimpleContentResourcePage from '../simple-content-resource-page.vue';
import { simplePagePageCrudConfig } from './config';
</script>

<template>
  <SimpleContentResourcePage
    :config="simplePagePageCrudConfig"
    resource-kind="page"
    :service="simplePageService"
  />
</template>
