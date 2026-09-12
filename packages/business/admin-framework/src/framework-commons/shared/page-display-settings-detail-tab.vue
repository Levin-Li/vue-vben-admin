<script lang="ts" setup>
import { Button, Form, Input, Popover, Switch, Tooltip } from 'ant-design-vue';

import type {
  CrudPageDisplayDetailViewConfig,
  CrudPageDisplayFieldConfig,
} from './types';

const props = defineProps<{
  config: CrudPageDisplayDetailViewConfig;
  fields: CrudPageDisplayFieldConfig[];
  previewLabel: (field: CrudPageDisplayFieldConfig) => string;
}>();

const emit = defineEmits<{
  'update:config': [value: CrudPageDisplayDetailViewConfig];
}>();

function updateConfig(patch: Partial<CrudPageDisplayDetailViewConfig>) {
  // 详情页签只更新自己的草稿片段，不介入主抽屉的保存与权限编排。
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
              v-for="field in fields"
              :key="field.key"
              class="border-border rounded border px-2 py-1 text-sm"
            >
              {{ previewLabel(field) }}
            </span>
          </div>
        </template>
        <Button>展示字段清单</Button>
      </Popover>
      <Tooltip title="留空沿用当前页面配置；支持 960px、80vw 等 CSS 长度。">
        <Form.Item label="弹窗最大宽度" class="mb-0">
          <Input
            :value="config.modalMaxWidth"
            class="w-[90px]"
            placeholder="80vw"
            @update:value="(value) => updateConfig({ modalMaxWidth: value })"
          />
        </Form.Item>
      </Tooltip>
      <Tooltip title="留空沿用当前页面配置；支持 70vh、720px 等 CSS 长度。">
        <Form.Item label="弹窗最大高度" class="mb-0">
          <Input
            :value="config.modalMaxHeight"
            class="w-[90px]"
            placeholder="70vh"
            @update:value="(value) => updateConfig({ modalMaxHeight: value })"
          />
        </Form.Item>
      </Tooltip>
      <Form.Item label="展示空值" class="mb-0">
        <Switch
          :checked="config.showEmptyValues"
          aria-label="展示空值"
          checked-children="展示"
          un-checked-children="隐藏"
          @update:checked="
            (value) => updateConfig({ showEmptyValues: value === true })
          "
        />
      </Form.Item>
    </Form>
  </section>
</template>
