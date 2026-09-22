<script lang="ts" setup>
import CrudPage from '../crud-page.vue';
import { noticePageCrudConfig } from './config';
import NoticeAreaScopeField from './notice-area-scope-field.vue';
import NoticeContentField from './notice-content-field.vue';
</script>

<template>
  <CrudPage :config="noticePageCrudConfig">
    <template #form-field-content="{ disabled, formState }">
      <!-- 内容编辑器由当前类型决定，类型变更时保留输入供管理员确认后继续编辑。 -->
      <NoticeContentField
        v-model="formState.content"
        :content-type="formState.contentType"
        :disabled="disabled"
      />
    </template>
    <template #form-field-matchAreaList="{ disabled, formState }">
      <!-- 区域范围使用行政区划选择器，提交省、市或区县编码数组。 -->
      <NoticeAreaScopeField
        v-model="formState.matchAreaList"
        :disabled="disabled"
      />
    </template>
  </CrudPage>
</template>
