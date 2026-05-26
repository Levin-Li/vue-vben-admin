<script lang="ts" setup>
import { ref } from 'vue';

import { Radio } from 'ant-design-vue';

import CrudPage from '../crud-page.vue';
import { fileResPageCrudConfig } from './config';
import ResourcePreviewView from './resource-preview-view.vue';

const activeView = ref<'list' | 'preview'>('list');
</script>

<template>
  <div class="file-resource-page">
    <div class="file-resource-page__switch">
      <Radio.Group v-model:value="activeView" button-style="solid">
        <Radio.Button value="list">列表</Radio.Button>
        <Radio.Button value="preview">资源预览</Radio.Button>
      </Radio.Group>
    </div>

    <CrudPage v-if="activeView === 'list'" :config="fileResPageCrudConfig" />
    <ResourcePreviewView v-else />
  </div>
</template>

<style scoped>
.file-resource-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-resource-page__switch {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 12px;
}
</style>
