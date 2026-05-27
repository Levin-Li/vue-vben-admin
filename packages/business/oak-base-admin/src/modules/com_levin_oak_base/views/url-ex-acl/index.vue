<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import PatternListFormField from '../pattern-list-form-field.vue';
import { urlExAclPageCrudConfig } from './config';
</script>

<template>
  <CrudPage :config="urlExAclPageCrudConfig">
    <template #form-field-urlPathList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-urlPathExcludeList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-methodList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-domainList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-regionList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-ipList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-ipExcludeList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-osList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-userTypeList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-userRoleList="{ field, formState }">
      <PatternListFormField v-model="formState[field.key]" :field="field" />
    </template>
  </CrudPage>
</template>
