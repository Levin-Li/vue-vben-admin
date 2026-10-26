<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { electronicContractTemplatePageCrudConfig } from './config';
import ContractTemplateDocxUpload from './contract-template-docx-upload.vue';
import ContractTemplateVariablesEditor from './contract-template-variables-editor.vue';
</script>

<template>
  <!-- 模板使用一张标准 CRUD 页面；受控文件上传只在新增表单出现。 -->
  <CrudPage :config="electronicContractTemplatePageCrudConfig">
    <template #form-field-fileResId="{ disabled, formState }">
      <ContractTemplateDocxUpload
        :disabled="disabled"
        :form-state="formState"
        @update="(values) => Object.assign(formState, values)"
      />
    </template>
    <template #form-field-templateFieldSchema="{ disabled, formState }">
      <ContractTemplateVariablesEditor
        :disabled="disabled"
        :form-state="formState"
        @update="(value) => (formState.templateFieldSchema = value)"
      />
    </template>
  </CrudPage>
</template>
