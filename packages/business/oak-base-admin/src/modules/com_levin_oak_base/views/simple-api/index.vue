<script lang="ts" setup>
import { simpleApiService } from '../../api/simple-api-service';
import SimpleContentResourcePage from '../simple-content-resource-page.vue';
import { simpleApiPageCrudConfig } from './config';
</script>

<template>
  <SimpleContentResourcePage
    :config="simpleApiPageCrudConfig"
    resource-kind="api"
    :service="simpleApiService"
  />
</template>
