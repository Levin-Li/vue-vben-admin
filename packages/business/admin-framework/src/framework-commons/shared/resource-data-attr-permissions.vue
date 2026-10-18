<script lang="ts" setup>
import type { DataAttrValuePermission } from './data-permission-types';

import { computed } from 'vue';

import { Checkbox, Popover, Tooltip } from 'ant-design-vue';

import { RbacPermissionMatchUtils } from '../rbac-permission-match';

// 只展示服务端提供的具体枚举许可，不推导表达式或自动授予操作权限。
const props = defineProps<{
  attributes: DataAttrValuePermission[];
  disabled?: boolean;
  selected: string[];
}>();
const emit = defineEmits<{
  toggle: [expressions: string[], checked: boolean];
}>();
const attributes = computed(() => mergeDataAttrs(props.attributes));

function checked(expression: string) {
  return RbacPermissionMatchUtils.simpleMatchList(expression, props.selected);
}

function toggle(expressions: string[], value: boolean) {
  if (!props.disabled) emit('toggle', expressions, value);
}
</script>

<script lang="ts">
// 重复菜单投影按实体属性、具体许可去重，禁止通过标签构造许可。
export function mergeDataAttrs(items: DataAttrValuePermission[]) {
  const merged = new Map<string, DataAttrValuePermission>();
  for (const item of items) {
    if (!item.entityClass || !item.attribute) continue;
    const key = `${item.entityClass}#${item.attribute}`;
    const previous = merged.get(key);
    const values = new Map(
      [...(previous?.values || []), ...(item.values || [])]
        .filter((value) => value.name && value.permissionExpr)
        .map((value) => [value.permissionExpr, value]),
    );
    if (values.size > 0)
      merged.set(key, { ...item, values: [...values.values()] });
  }
  return [...merged.values()];
}
</script>

<template>
  <Popover v-if="attributes.length > 0" trigger="click" placement="bottomLeft">
    <template #content>
      <div class="max-h-80 max-w-96 space-y-3 overflow-y-auto" @click.stop>
        <div class="text-muted-foreground text-xs">
          未勾选表示无许可；全选仅包含当前列出的枚举值。
        </div>
        <div
          v-for="attribute in attributes"
          :key="`${attribute.entityClass}#${attribute.attribute}`"
          class="space-y-1"
        >
          <div class="flex items-center gap-3">
            <Tooltip :title="attribute.remark || attribute.entityName">
              <span>{{ attribute.name || attribute.attribute }}</span>
            </Tooltip>
            <Checkbox
              :checked="
                attribute.values.every((value) => checked(value.permissionExpr))
              "
              :indeterminate="
                attribute.values.some((value) =>
                  checked(value.permissionExpr),
                ) &&
                !attribute.values.every((value) =>
                  checked(value.permissionExpr),
                )
              "
              :disabled="disabled"
              :data-test="`data-attr-all-${attribute.attribute}`"
              @change="
                toggle(
                  attribute.values.map((value) => value.permissionExpr),
                  $event.target.checked,
                )
              "
            >
              全选
            </Checkbox>
          </div>
          <div class="flex flex-wrap gap-x-3 gap-y-1">
            <Checkbox
              v-for="value in attribute.values"
              :key="value.permissionExpr"
              :checked="checked(value.permissionExpr)"
              :disabled="disabled"
              :data-test="`data-attr-value-${value.permissionExpr}`"
              @change="toggle([value.permissionExpr], $event.target.checked)"
            >
              {{ value.label || value.name }}
            </Checkbox>
          </div>
        </div>
      </div>
    </template>
    <button
      class="text-primary ml-2 text-xs"
      type="button"
      data-test="data-attrs-trigger"
      @click.stop.prevent
    >
      数据范围
    </button>
  </Popover>
</template>
