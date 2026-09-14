<!-- 第二版独立副本：来源 stable/page-display-settings-performance-20260912，后续界面修改仅维护本文件。 -->
<script lang="ts" setup>
import {
  Button,
  Form,
  InputNumber,
  Popover,
  Radio,
  Switch,
  Tooltip,
} from 'ant-design-vue';

import type {
  CrudPageDisplayConfig,
  CrudPageDisplayHeaderConfig,
} from './types';

type CrudPageDisplayListConfig = NonNullable<CrudPageDisplayConfig['list']>;

const props = defineProps<{
  config: CrudPageDisplayListConfig;
  headers: CrudPageDisplayHeaderConfig[];
  previewLabel: (header: CrudPageDisplayHeaderConfig) => string;
}>();

const emit = defineEmits<{
  addVirtualField: [];
  'update:config': [value: CrudPageDisplayListConfig];
}>();

function updateConfig(patch: Partial<CrudPageDisplayListConfig>) {
  // 列表页签仅维护列表草稿，保存时仍由主抽屉统一校验并上传。
  emit('update:config', { ...props.config, ...patch });
}
</script>

<template>
  <!-- 专属设置融入主抽屉工具区，避免重复外框和外围间距。 -->
  <section class="contents">
    <Form layout="inline" :style="{ display: 'contents' }">
      <Popover placement="bottomLeft" title="展示字段清单" trigger="hover">
        <template #content>
          <div class="flex max-w-80 flex-wrap gap-2">
            <span
              v-for="header in headers"
              :key="header.key"
              class="border-border rounded border px-2 py-1 text-sm"
            >
              {{ previewLabel(header) }}
            </span>
          </div>
        </template>
        <Button>展示字段清单</Button>
      </Popover>
      <Tooltip
        title="新增前端虚拟列。其值由当前行的值展示脚本计算，不对应后端实体字段。"
      >
        <Button @click="emit('addVirtualField')">+ 添加虚拟字段</Button>
      </Tooltip>
      <Tooltip
        title="开启后按当前分页实际行数完整展示，不补空白行、不加载其他页；取消表格内纵向滚动，仅本页内容区域纵向滚动，保留分页和横向滚动。"
      >
        <Form.Item label="显示完整分页" class="mb-0">
          <Switch
            :checked="config.showAllPageRows"
            @update:checked="
              (value) => updateConfig({ showAllPageRows: value === true })
            "
          />
        </Form.Item>
      </Tooltip>
      <Tooltip title="列表列未单独配置最小列宽时使用。">
        <Form.Item label="默认最小列宽" class="mb-0">
          <InputNumber
            :value="config.defaultMinColumnWidth"
            :min="40"
            :precision="0"
            addon-after="px"
            class="w-[100px]"
            placeholder="60"
            @update:value="
              (value) =>
                updateConfig({
                  defaultMinColumnWidth:
                    typeof value === 'number' ? value : undefined,
                })
            "
          />
        </Form.Item>
      </Tooltip>
      <Tooltip title="列表列未单独配置最大宽度时使用；留空表示不限制。">
        <Form.Item label="默认最大列宽" class="mb-0">
          <InputNumber
            :value="config.defaultMaxColumnWidth"
            :min="40"
            :precision="0"
            addon-after="px"
            class="compact-column-width w-20"
            placeholder="不限制"
            @update:value="
              (value) =>
                updateConfig({
                  defaultMaxColumnWidth:
                    typeof value === 'number' ? value : undefined,
                })
            "
          />
        </Form.Item>
      </Tooltip>
      <Tooltip
        title="列表列超出默认最大列宽时的展示方式；字段代码显式策略优先。"
      >
        <Form.Item label="默认超宽展示" class="mb-0">
          <Radio.Group
            :value="config.defaultOverflowStrategy"
            button-style="solid"
            option-type="button"
            :options="[
              { label: '截断', value: 'ellipsis' },
              { label: '换行', value: 'wrap' },
            ]"
            @update:value="
              (value) =>
                updateConfig({
                  defaultOverflowStrategy:
                    value === 'ellipsis' || value === 'wrap'
                      ? value
                      : undefined,
                })
            "
          />
        </Form.Item>
      </Tooltip>
    </Form>
  </section>
</template>

<style scoped>
/* 缩窄输入后减少内部留白，保证三位数与 px 单位同时可读。 */
.compact-column-width :deep(.ant-input-number-input) {
  padding-inline: 6px;
}
</style>
