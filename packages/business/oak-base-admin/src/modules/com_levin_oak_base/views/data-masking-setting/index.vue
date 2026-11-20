<script lang="ts" setup>
import { Tag } from 'ant-design-vue';

import CrudPage from '../crud-page.vue';
import { dataMaskingSettingPageCrudConfig } from './config';
import RuleEditor from './rule-editor.vue';
</script>

<template>
  <CrudPage :config="dataMaskingSettingPageCrudConfig">
    <!-- 更新必须携带完整规则，启停通过编辑表单完成，避免部分更新绕过旧规则校验。 -->
    <template #table-cell-enable="{ record }">
      <Tag v-if="record.enable === true" color="green">启用</Tag>
      <Tag v-else-if="record.enable === false" color="red">禁用</Tag>
      <span v-else>—</span>
    </template>
    <template #form-field-valueContent="{ formState }">
      <RuleEditor :form-state="formState" />
    </template>
  </CrudPage>
</template>
