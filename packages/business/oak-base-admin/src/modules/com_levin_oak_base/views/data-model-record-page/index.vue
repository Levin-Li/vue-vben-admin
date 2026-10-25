<script setup lang="ts">
import type { DataModelDefinition } from '../../api/data-model-service';

import { computed, onActivated, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Alert, Spin } from 'ant-design-vue';

import { dataModelService } from '../../api/data-model-service';
import DataModelRecordPage from '../data-model-record/index.vue';
import {
  modelMetadataCache,
  useModelMetadataContext,
} from '../data-model/model-metadata';

const route = useRoute();
const metadataContext = useModelMetadataContext();
const modelKey = computed(() => {
  const fixed = route.meta.fixedQuery;
  const fixedKey =
    fixed && typeof fixed === 'object' && !Array.isArray(fixed)
      ? (fixed as Record<string, unknown>).modelKey
      : undefined;
  const value = fixedKey === undefined ? route.query?.modelKey : fixedKey;
  return typeof value === 'string' && /^[a-z][a-z0-9_]{0,47}$/.test(value)
    ? value
    : undefined;
});
const model = ref<DataModelDefinition>();
// 相同同步版本也可能有新的授权字段投影；完全相同目录刷新保留表单草稿。
const modelProjectionKey = computed(() => JSON.stringify(model.value));
let projectedContext = '';
const loading = ref(false);
const error = ref('');
let generation = 0;

// 菜单参数只定位模型；每次进入都重新读取已同步目录，权限由后端逐次校验。
async function load() {
  const request = ++generation;
  const context = metadataContext.value;
  const requestedKey = modelKey.value;
  // 真实身份/权限/范围变化立即清空旧投影；同上下文刷新保留当前实例直到完成重验。
  if (
    projectedContext !== context ||
    (model.value && model.value.key !== requestedKey)
  ) {
    model.value = undefined;
  }
  error.value = '';
  if (!requestedKey) {
    model.value = undefined;
    loading.value = false;
    error.value = '通用模型目录入口已移除，请从具体业务菜单进入';
    return;
  }
  loading.value = true;
  try {
    const catalog = await modelMetadataCache.read(context, 'catalog', () =>
      dataModelService.catalog(),
    );
    if (request !== generation) return;
    projectedContext = context;
    model.value = catalog.find((item) => item.key === requestedKey);
    if (!model.value) {
      error.value = '数据模型已停用、未同步或当前用户无权访问';
    }
  } catch {
    if (request === generation) {
      model.value = undefined;
      error.value = '数据模型目录加载失败';
    }
  } finally {
    if (request === generation) loading.value = false;
  }
}

watch(
  () => [modelKey.value, metadataContext.value],
  () => {
    void load();
  },
  { immediate: true, flush: 'pre' },
);
onActivated(() => {
  void load();
});
</script>

<template>
  <div class="p-4">
    <Spin :spinning="loading">
      <Alert v-if="error" type="warning" show-icon :message="error" />
      <div v-else-if="model">
        <DataModelRecordPage :key="modelProjectionKey" :model="model" />
      </div>
    </Spin>
  </div>
</template>
