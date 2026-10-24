<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { electronicContractTemplatePageCrudConfig } from './config';
import ContractTemplateDocxUpload from './contract-template-docx-upload.vue';
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
  </CrudPage>
</template>

<style scoped>
/* 文件元数据由受控上传接口写入表单状态，不单独展示为可编辑输入。 */
:deep([data-crud-form-field='fileName']),
:deep([data-crud-form-field='fileUrl']),
:deep([data-crud-form-field='fileHash']),
:deep([data-crud-form-field='mimeType']) {
  display: none;
}
</style>
