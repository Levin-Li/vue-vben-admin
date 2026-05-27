<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { trafficControlRulePageCrudConfig } from './config';
import MatchTestField from './match-test-field.vue';
</script>

<template>
  <CrudPage :config="trafficControlRulePageCrudConfig">
    <template #form-field-urlPathList="{ field, formState }">
      <MatchTestField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-urlPathExcludeList="{ field, formState }">
      <MatchTestField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-methodList="{ field, formState }">
      <MatchTestField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-domainList="{ field, formState }">
      <MatchTestField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-regionList="{ field, formState }">
      <MatchTestField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-ipList="{ field, formState }">
      <MatchTestField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-ipExcludeList="{ field, formState }">
      <MatchTestField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-userTypeList="{ field, formState }">
      <MatchTestField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-userRoleList="{ field, formState }">
      <MatchTestField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-limitDimensionList="{ field, formState }">
      <MatchTestField v-model="formState[field.key]" :field="field" />
    </template>
    <template #form-field-requestParamRuleList="{ field, formState }">
      <MatchTestField
        v-model="formState[field.key]"
        :field="field"
        rule-kind="nameValue"
      />
    </template>
    <template #form-field-headerRuleList="{ field, formState }">
      <MatchTestField
        v-model="formState[field.key]"
        :field="field"
        rule-kind="nameValue"
      />
    </template>
  </CrudPage>
</template>
