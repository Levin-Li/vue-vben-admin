<script setup lang="ts">
import type { DataModelDefinition } from '../../api/data-model-service';

import { computed, onActivated, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import CrudLayout from '@levin/admin-framework/framework-commons/shared/crud-layout.vue';
import { Alert, Button, Spin, Table } from 'ant-design-vue';

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
const selectedModelKey = ref<string>();
// 相同同步版本也可能有新的授权字段投影；完全相同目录刷新保留表单草稿。
const modelProjectionKey = computed(() => JSON.stringify(model.value));
let projectedContext = '';
const catalogModels = ref<DataModelDefinition[]>([]);
const loading = ref(false);
const error = ref('');
let generation = 0;

// 菜单参数只定位模型；每次进入都重新读取已同步目录，权限由后端逐次校验。
async function load(force = false) {
  const request = ++generation;
  const context = metadataContext.value;
  const requestedKey = modelKey.value || selectedModelKey.value;
  // 真实身份/权限/范围变化立即清空旧投影；同上下文刷新保留当前实例直到完成重验。
  if (
    projectedContext !== context ||
    (model.value && model.value.key !== requestedKey)
  ) {
    model.value = undefined;
    catalogModels.value = [];
  }
  error.value = '';
  loading.value = true;
  try {
    const catalog = await modelMetadataCache.read(
      context,
      'catalog',
      () => dataModelService.catalog(),
      force,
    );
    if (request !== generation) return;
    projectedContext = context;
    catalogModels.value = catalog;
    if (!requestedKey) {
      model.value = undefined;
      return;
    }
    model.value = catalog.find((item) => item.key === requestedKey);
    if (!model.value) {
      selectedModelKey.value = undefined;
      error.value = '数据模型已停用、未同步或当前用户无权访问';
    }
  } catch {
    if (request === generation) {
      model.value = undefined;
      catalogModels.value = [];
      error.value = '数据模型目录加载失败';
    }
  } finally {
    if (request === generation) loading.value = false;
  }
}

function selectModel(key: string) {
  selectedModelKey.value = key;
  if (projectedContext === metadataContext.value)
    model.value = catalogModels.value.find((item) => item.key === key);
  else void load();
}
function returnToCatalog() {
  selectedModelKey.value = undefined;
  model.value = undefined;
  void load(true);
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
      <div v-if="error">
        <Alert type="warning" show-icon :message="error" />
        <Button v-if="!modelKey" class="mt-3" @click="returnToCatalog">
          返回模型数据
        </Button>
      </div>
      <div v-else-if="!modelKey && !model">
        <CrudLayout form-id="data-model-catalog" form-name="领域模型目录">
          <template #toolbar>
            <h2 class="mr-auto text-lg">领域模型数据</h2>
            <Button @click="load(true)">刷新目录</Button>
          </template>
          <Table
            :data-source="catalogModels"
            :columns="[
              { title: '模型标识', dataIndex: 'key' },
              { title: '模型名称', dataIndex: 'title' },
              { title: '说明', dataIndex: 'description' },
              { title: '操作', key: 'open' },
            ]"
            row-key="key"
          >
            <template #bodyCell="{ column, record }">
              <Button
                v-if="column.key === 'open'"
                type="link"
                @click="selectModel(String(record.key))"
              >
                使用模型
              </Button>
            </template>
          </Table>
        </CrudLayout>
      </div>
      <div v-else-if="model">
        <Button v-if="!modelKey" class="mb-3" @click="returnToCatalog">
          返回模型数据
        </Button>
        <DataModelRecordPage :key="modelProjectionKey" :model="model" />
      </div>
    </Spin>
  </div>
</template>
