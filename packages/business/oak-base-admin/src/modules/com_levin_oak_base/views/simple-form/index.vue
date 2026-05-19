<script lang="ts" setup>
import { simpleFormService } from '../../api/simple-form-service';
import SimpleContentResourcePage from '../simple-content-resource-page.vue';
import { simpleFormPageCrudConfig } from './config';
</script>

<template>
  <SimpleContentResourcePage
    :config="simpleFormPageCrudConfig"
    resource-kind="form"
    :service="simpleFormService"
  />
</template>
