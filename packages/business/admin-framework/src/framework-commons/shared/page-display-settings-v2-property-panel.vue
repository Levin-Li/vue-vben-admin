<script setup lang="ts">
import type { CrudDisplaySubmitMode } from './crud-page-display';
import type {
  CrudFieldConfig,
  CrudPageDisplayActionConfig,
  CrudPageDisplayFieldConfig,
  CrudPageDisplayGroupConfig,
  CrudPageDisplayHeaderConfig,
} from './types';

import { computed } from 'vue';

import {
  Button,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Switch,
  Tooltip,
} from 'ant-design-vue';

import {
  getDisplaySubmitMode,
  setDisplaySubmitMode,
  supportsInlineChoiceOptions,
} from './crud-page-display';

// 第二版仅接收当前选中项；所有修改交给父级草稿，读取属性时不补写响应式对象。
const props = defineProps<{
  fieldOptions: Array<{ label: string; value: string }>;
  item:
    | CrudPageDisplayActionConfig
    | CrudPageDisplayFieldConfig
    | CrudPageDisplayGroupConfig
    | CrudPageDisplayHeaderConfig;
  kind: 'action' | 'field' | 'group';
  roleLoading?: boolean;
  roleOptions: Array<{ label: string; value: string }>;
  sourceField?: CrudFieldConfig;
  title: string;
  view: 'create' | 'detail' | 'edit' | 'list' | 'query';
}>();
const emit = defineEmits<{
  loadRoles: [];
  patch: [value: Record<string, unknown>];
  script: [
    target:
      | 'actionValue'
      | 'actionVisibility'
      | 'fieldVisibility'
      | 'groupVisibility'
      | 'headerValue'
      | 'headerVisibility',
  ];
}>();

// 视图分支只创建一份编辑器，字段、列表列和分组仍保留各自既有配置语义。
const field = computed(() => props.item as CrudPageDisplayFieldConfig);
const column = computed(() => props.item as CrudPageDisplayHeaderConfig);
const group = computed(() => props.item as CrudPageDisplayGroupConfig);
const isColumn = computed(
  () =>
    props.kind === 'action' ||
    (props.kind === 'field' && props.view === 'list'),
);
const visibilityExpression = computed(() =>
  isColumn.value
    ? column.value.visible?.expression
    : field.value.visibility?.expression,
);
const visibilityTarget = computed(() => {
  if (props.kind === 'group') return 'groupVisibility';
  if (props.kind === 'action') return 'actionVisibility';
  return props.view === 'list' ? 'headerVisibility' : 'fieldVisibility';
});
const visibilityTooltip = computed(() => {
  if (props.kind === 'group') {
    return '编写脚本决定整个分组是否展示；不展示时组内字段不提交。';
  }
  if (props.kind === 'action') {
    return '使用当前行数据、当前用户、组织和租户设置附加显示条件；表达式失败时隐藏该操作。';
  }
  return props.view === 'list'
    ? '编写脚本决定当前列是否展示。'
    : '编写脚本决定字段是否展示。';
});
const valueTooltip = computed(() =>
  props.kind === 'action'
    ? '返回非空文本时，它会以最高优先级作为按钮名称。'
    : '编写脚本转换当前字段在每一行中的展示内容。',
);
const emptyKeys: string[] = [];

// 固定选项保持稳定引用，避免切换字段时让选择器进行无意义的深层更新。
const defaultInputOptions = [{ label: '默认', value: 'default' }];
const inlineInputOptions = [
  ...defaultInputOptions,
  { label: '平铺选项', value: 'inline-options' },
];
const inputOptions = computed(() =>
  props.sourceField && supportsInlineChoiceOptions(props.sourceField)
    ? inlineInputOptions
    : defaultInputOptions,
);
const overflowOptions = [
  { label: '默认', value: undefined },
  { label: '截断', value: 'ellipsis' },
  { label: '换行', value: 'wrap' },
];
const groupStyleOptions = [
  { label: '默认', value: 'divider' },
  { label: '卡片', value: 'card' },
  { label: '边框', value: 'border' },
];
const expandedRowsOptions = [
  { label: '展开所有字段', value: 'all' },
  ...Array.from({ length: 10 }, (_, index) => ({
    label: `${index + 1} 行`,
    value: index + 1,
  })),
];

// 嵌套规则通过浅复制保留其它属性，避免编辑依赖项时丢失脚本或互斥条件。
function patchProperty(key: string, value: unknown) {
  emit('patch', { [key]: value });
}

function updateDefaultValue(value: unknown) {
  emit('patch', { defaultValue: { ...field.value.defaultValue, value } });
}

function updateRelation(key: 'dependsOn' | 'exclusiveWith', value: unknown) {
  emit('patch', {
    visibility: {
      ...field.value.visibility,
      [key]: { fieldKeys: value as string[] },
    },
  });
}

function updateSubmitMode(value: CrudDisplaySubmitMode) {
  const next = { ...field.value };
  setDisplaySubmitMode(next, value);
  emit('patch', {
    hidden: next.hidden,
    disabled: next.disabled,
    submitWhenHidden: next.submitWhenHidden,
  });
}

function scriptLabel(expression?: string) {
  return expression?.trim() ? '编辑脚本' : '添加脚本';
}
</script>

<template>
  <section
    data-test="page-display-v2-property-panel"
    class="page-display-v2-property-panel min-w-0"
  >
    <!-- 标题始终标明当前选中对象，属性名作为识别信息不参与修改。 -->
    <header class="border-border mb-4 border-b pb-3">
      <h3 class="text-base font-medium">{{ title }}</h3>
      <div class="text-muted-foreground mt-1 break-all text-xs">
        {{ item.key }}
      </div>
    </header>

    <!-- 标签与控件左右排列，常规宽度下一行两项，复杂关系跨行呈现。 -->
    <Form
      layout="horizontal"
      label-align="left"
      :label-col="{ flex: 'none' }"
      :wrapper-col="{ flex: '1 1 0' }"
      :colon="false"
      class="page-display-v2-property-form"
      @submit.prevent
    >
      <!-- 字段别名与归属统一在左侧维护，此处只保留分组对象自身的标题。 -->
      <Form.Item v-if="kind === 'group'" label="分组标题">
        <Input
          :value="group.title"
          :placeholder="title"
          aria-label="分组标题"
          @update:value="patchProperty('title', $event)"
        />
      </Form.Item>

      <template v-if="kind === 'field' && !isColumn">
        <!-- 高频显隐控制置顶，后续默认值和展示方式仍沿用原编辑逻辑。 -->
        <Form.Item
          v-if="view !== 'detail'"
          label="展示与提交"
          class="page-display-v2-property-full-row"
        >
          <Radio.Group
            :value="getDisplaySubmitMode(field)"
            button-style="solid"
            aria-label="展示与提交"
            @update:value="updateSubmitMode"
          >
            <Radio.Button value="display-submit">
              <Tooltip title="展示控件并参与提交">
                <span>展提</span>
              </Tooltip>
            </Radio.Button>
            <Radio.Button value="hidden-submit">
              <Tooltip title="不展示控件仍参与提交">
                <span>隐提</span>
              </Tooltip>
            </Radio.Button>
            <Radio.Button value="disabled-submit">
              <Tooltip title="展示控件但不可修改仍参与提交">
                <span>禁提</span>
              </Tooltip>
            </Radio.Button>
            <Radio.Button value="hidden-omit">
              <Tooltip title="不展示控件也不参与校验和提交">
                <span>不提</span>
              </Tooltip>
            </Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item v-else label="是否展示">
          <Switch
            :checked="!field.hidden"
            checked-children="展示"
            un-checked-children="不展示"
            aria-label="是否展示"
            @update:checked="patchProperty('hidden', !$event)"
          />
        </Form.Item>
        <Form.Item v-if="view === 'query'" label="标题展示">
          <Radio.Group
            :value="field.titleVisibility || 'default'"
            button-style="solid"
            @update:value="patchProperty('titleVisibility', $event)"
          >
            <Radio.Button value="default">默认</Radio.Button>
            <Radio.Button value="visible">展示</Radio.Button>
            <Radio.Button value="hidden">不展示</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="默认值">
          <InputNumber
            :value="field.defaultValue?.value"
            class="w-full"
            placeholder="默认值"
            aria-label="默认值"
            @update:value="updateDefaultValue"
          />
        </Form.Item>
        <Form.Item label="展示方式">
          <Select
            :value="field.inputDisplay"
            :options="inputOptions"
            aria-label="展示方式"
            @update:value="patchProperty('inputDisplay', $event)"
          />
        </Form.Item>
        <Form.Item label="依赖显示项" class="page-display-v2-property-full-row">
          <Select
            :value="field.visibility?.dependsOn?.fieldKeys || emptyKeys"
            mode="multiple"
            :options="fieldOptions"
            option-filter-prop="label"
            aria-label="依赖显示项"
            @update:value="updateRelation('dependsOn', $event)"
          />
        </Form.Item>
        <Form.Item label="互斥项" class="page-display-v2-property-full-row">
          <Select
            :value="field.visibility?.exclusiveWith?.fieldKeys || emptyKeys"
            mode="multiple"
            :options="fieldOptions"
            option-filter-prop="label"
            aria-label="互斥项"
            @update:value="updateRelation('exclusiveWith', $event)"
          />
        </Form.Item>
      </template>

      <!-- 列和操作共享尺寸编辑外观，数值限制仍遵循各自原有边界。 -->
      <template v-if="isColumn">
        <Form.Item label="列宽">
          <InputNumber
            :value="column.width"
            :min="kind === 'action' ? undefined : 40"
            :precision="0"
            addon-after="px"
            placeholder="默认"
            class="w-full"
            aria-label="列宽"
            @update:value="patchProperty('width', $event)"
          />
        </Form.Item>
        <Form.Item label="最小列宽">
          <InputNumber
            :value="column.minWidth"
            :min="kind === 'action' ? -1 : 40"
            :precision="0"
            addon-after="px"
            placeholder="不限制"
            class="w-full"
            aria-label="最小列宽"
            @update:value="patchProperty('minWidth', $event)"
          />
        </Form.Item>
        <Form.Item label="最大列宽">
          <InputNumber
            :value="column.maxWidth"
            :min="kind === 'action' ? -1 : 40"
            :precision="0"
            addon-after="px"
            placeholder="默认"
            class="w-full"
            aria-label="最大列宽"
            @update:value="patchProperty('maxWidth', $event)"
          />
        </Form.Item>
        <Form.Item label="超宽展示样式">
          <Radio.Group
            :value="column.overflowStrategy"
            :options="overflowOptions"
            button-style="solid"
            option-type="button"
            aria-label="超宽展示样式"
            @update:value="patchProperty('overflowStrategy', $event)"
          />
        </Form.Item>
        <Form.Item
          v-if="kind === 'action' || item.key !== '__actions'"
          label="展示值脚本"
        >
          <Tooltip :title="valueTooltip">
            <Button
              aria-label="展示值脚本"
              @click="
                emit(
                  'script',
                  kind === 'action' ? 'actionValue' : 'headerValue',
                )
              "
            >
              {{ scriptLabel(column.valueDisplay?.expression) }}
            </Button>
          </Tooltip>
        </Form.Item>
      </template>

      <!-- 分组属性与字段属性分开呈现，删除操作仍由父级统一处理字段归属。 -->
      <template v-if="kind === 'group'">
        <Form.Item label="组自动折叠行数">
          <Select
            :value="group.defaultExpandedRows"
            :options="expandedRowsOptions"
            aria-label="组自动折叠行数"
            @update:value="patchProperty('defaultExpandedRows', $event)"
          />
        </Form.Item>
        <Form.Item label="分组展示样式">
          <Select
            :value="group.displayStyle"
            :options="groupStyleOptions"
            aria-label="分组展示样式"
            @update:value="patchProperty('displayStyle', $event)"
          />
        </Form.Item>
        <Form.Item
          v-if="view === 'create' || view === 'edit'"
          label="显示提交勾选"
        >
          <Switch
            :checked="group.showSubmitCheckbox === true"
            aria-label="显示提交勾选"
            @update:checked="patchProperty('showSubmitCheckbox', $event)"
          />
        </Form.Item>
      </template>

      <!-- 角色候选按需由父级加载，脚本工作台仅在用户点击时打开。 -->
      <Form.Item label="可见角色" class="page-display-v2-property-full-row">
        <Select
          :value="item.visibleRoleCodes || emptyKeys"
          mode="multiple"
          :loading="roleLoading"
          :options="roleOptions"
          option-filter-prop="label"
          placeholder="不限制"
          aria-label="可见角色"
          @update:value="patchProperty('visibleRoleCodes', $event)"
          @focus="emit('loadRoles')"
          @dropdown-visible-change="(open) => open && emit('loadRoles')"
        />
      </Form.Item>
      <Form.Item label="显示脚本">
        <Tooltip :title="visibilityTooltip">
          <Button
            aria-label="显示脚本"
            @click="emit('script', visibilityTarget)"
          >
            {{ scriptLabel(visibilityExpression) }}
          </Button>
        </Tooltip>
      </Form.Item>
    </Form>
  </section>
</template>

<style scoped>
/* 按整项固有最小宽度换行，标签不拆字；最多两项同排，放不下的项目自动占整行。 */
.page-display-v2-property-panel {
  container-type: inline-size;
}

.page-display-v2-property-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}

.page-display-v2-property-form :deep(.ant-form-item) {
  flex: 1 1 calc(50% - 8px);
  min-width: min-content;
  max-width: 100%;
}

.page-display-v2-property-form :deep(.ant-form-item-row) {
  flex-wrap: nowrap;
}

.page-display-v2-property-form :deep(.ant-form-item-control) {
  min-width: 140px;
  inline-size: 0;
}

.page-display-v2-property-form :deep(.ant-form-item-label) {
  min-width: 84px;
  padding-inline-end: 8px;
  white-space: nowrap;
}

.page-display-v2-property-form :deep(.ant-form-item-label > label) {
  white-space: nowrap;
}

.page-display-v2-property-form :deep(.page-display-v2-property-full-row) {
  flex-basis: 100%;
  min-width: 0;
}

/* 依据右侧面板自身宽度回落，不让窄屏控件挤成无法编辑的细条。 */
@container (max-width: 480px) {
  .page-display-v2-property-form :deep(.ant-form-item) {
    flex-basis: 100%;
    min-width: 0;
  }

  .page-display-v2-property-form :deep(.ant-form-item-control) {
    min-width: 0;
  }
}
</style>
