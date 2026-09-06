<script lang="ts" setup>
import SettingCrudPage from '../setting-crud-page.vue';
import { uiSettingPageCrudConfig } from './config';

function serializeUiSettingValueContent(
  _record: Record<string, any>,
  value: unknown,
) {
  return value;
}
</script>

<template>
  <SettingCrudPage
    :config="uiSettingPageCrudConfig"
    :history-biz-type="'com.levin.oak.base.entities.UiSetting'"
    force-json-value-editor
    :serialize-value-content="serializeUiSettingValueContent"
  />
</template>
