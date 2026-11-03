<script lang="ts" setup>
import type {
  DataAttrValuePermission,
  RbacDataAttrGroup,
} from './data-permission-types';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/runtime/icons';

import { Checkbox, Popover, Tooltip } from 'ant-design-vue';

import { mergedApiScopedGrant } from './api-scoped-grant';

const props = defineProps<{
  attributes?: DataAttrValuePermission[];
  disabledFields?: string[];
  disabledGroups?: string[];
  enabled: boolean;
  groups: RbacDataAttrGroup[];
  operation: string;
  partialGroups?: string[];
  partialValues?: string[];
  selected: string[];
}>();

const emit = defineEmits<{
  toggleGroup: [name: string, checked: boolean];
  toggleValues: [sourceField: string, values: string[], checked: boolean];
}>();

// 只读取当前操作对应的复合授权，旧实体级组不会被误当作新勾选。
const currentGrant = computed(() =>
  mergedApiScopedGrant(props.selected, props.operation),
);
const selectedGroups = computed(
  () => new Set(currentGrant.value?.groups || []),
);

// 未携带服务端来源标识的旧资源候选不能推导为新接口授权。
const supportedAttributes = computed(() =>
  (props.attributes || []).filter(
    (item) =>
      (item.sourceKind === 'enum' || item.sourceKind === 'dict') &&
      item.sourceKey &&
      item.values.length > 0,
  ),
);

function fieldKey(attribute: DataAttrValuePermission) {
  return `${attribute.sourceKind}#${attribute.sourceKey}#${attribute.attribute}`;
}

function selectedValues(attribute: DataAttrValuePermission) {
  return new Set(currentGrant.value?.values[fieldKey(attribute)] || []);
}

const selectedCount = computed(() => {
  if (!props.enabled) return 0;
  const groups = props.groups.filter((group) =>
    selectedGroups.value.has(displayName(group)),
  ).length;
  const values = supportedAttributes.value.reduce(
    (count, attribute) =>
      count +
      attribute.values.filter((value) =>
        selectedValues(attribute).has(value.name),
      ).length,
    0,
  );
  return groups + values;
});

const selectedPreview = computed(() => {
  if (!props.enabled) return '';
  const groups = props.groups
    .filter((group) => selectedGroups.value.has(displayName(group)))
    .map((group) => displayName(group));
  const fields = supportedAttributes.value.flatMap((attribute) => {
    const values = attribute.values
      .filter((value) => selectedValues(attribute).has(value.name))
      .map((value) => value.label || value.name);
    return values.length > 0
      ? [`${attribute.name || attribute.attribute}：${values.join('、')}`]
      : [];
  });
  return [
    ...(groups.length > 0 ? [`信息组：${groups.join('、')}`] : []),
    ...fields,
  ].join('\n');
});

function toggleValue(
  attribute: DataAttrValuePermission,
  values: string[],
  checked: boolean,
) {
  if (!props.enabled) return;
  emit('toggleValues', fieldKey(attribute), values, checked);
}

function displayName(group: RbacDataAttrGroup) {
  return group.name.replaceAll(/\s+/gu, '');
}
</script>

<template>
  <Popover
    v-if="groups.length > 0 || supportedAttributes.length > 0"
    trigger="click"
    placement="bottomLeft"
  >
    <template #content>
      <div class="max-h-80 min-w-52 space-y-3 overflow-y-auto" @click.stop>
        <div v-if="!enabled" class="text-muted-foreground text-xs">
          请先勾选接口操作
        </div>
        <div v-if="groups.length > 0" class="space-y-2">
          <div class="text-muted-foreground text-xs">信息组</div>
          <div v-for="group in groups" :key="group.permissionExpr">
            <Checkbox
              :checked="
                selectedGroups.has(displayName(group)) &&
                !partialGroups?.includes(displayName(group))
              "
              :indeterminate="partialGroups?.includes(displayName(group))"
              :disabled="
                !enabled || disabledGroups?.includes(displayName(group))
              "
              :data-test="`api-group-${operation}-${group.name}`"
              @change="
                emit('toggleGroup', displayName(group), $event.target.checked)
              "
            >
              <Tooltip :title="group.attributes.join('、') || undefined">
                {{ displayName(group) }}
              </Tooltip>
            </Checkbox>
          </div>
        </div>
        <div
          v-for="attribute in supportedAttributes"
          :key="fieldKey(attribute)"
          class="space-y-1"
        >
          <div class="text-muted-foreground text-xs">
            {{ attribute.name || attribute.attribute }}
          </div>
          <div class="flex flex-wrap gap-x-3 gap-y-1">
            <Checkbox
              v-for="value in attribute.values"
              :key="value.name"
              :checked="
                selectedValues(attribute).has(value.name) &&
                !partialValues?.includes(`${fieldKey(attribute)}@${value.name}`)
              "
              :indeterminate="
                partialValues?.includes(`${fieldKey(attribute)}@${value.name}`)
              "
              :disabled="
                !enabled || disabledFields?.includes(fieldKey(attribute))
              "
              :data-test="`api-value-${operation}-${fieldKey(attribute)}-${value.name}`"
              @change="
                toggleValue(attribute, [value.name], $event.target.checked)
              "
            >
              {{ value.label || value.name }}
            </Checkbox>
          </div>
        </div>
      </div>
    </template>
    <Tooltip
      :title="selectedPreview || undefined"
      :mouse-enter-delay="0.7"
      :overlay-inner-style="{ whiteSpace: 'pre-line' }"
    >
      <button
        class="text-primary ml-2 inline-flex items-center gap-1 text-xs"
        type="button"
        :data-test="`api-data-trigger-${operation}`"
        @click.stop.prevent
      >
        <IconifyIcon aria-hidden="true" class="size-3.5" icon="lucide:tags" />
        信息权限
        <span
          v-if="selectedCount > 0"
          :aria-label="`已选 ${selectedCount} 项信息权限`"
          class="bg-success text-success-foreground inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4"
        >
          {{ selectedCount }}
        </span>
      </button>
    </Tooltip>
  </Popover>
</template>
