<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import PatternListFormField from '../pattern-list-form-field.vue';
import { clientAppPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="clientAppPageCrudConfig">
    <template #form-field-allowedPathPatterns="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-allowedIpList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
  </CrudPage>
</template>
