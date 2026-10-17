<script lang="ts" setup>
import type { RbacDataAttrGroup } from './data-permission-types';

import { computed } from 'vue';

import { Checkbox, Popover, Tooltip } from 'ant-design-vue';

import { RbacPermissionMatchUtils } from '../rbac-permission-match';

const props = defineProps<{
  enabled: boolean;
  groups: RbacDataAttrGroup[];
  selected: string[];
}>();
const emit = defineEmits<{
  toggle: [expression: string, checked: boolean];
}>();

const repeatedNames = computed(() => {
  const names = new Set<string>();
  const repeated = new Set<string>();
  for (const group of props.groups) {
    if (names.has(group.name)) repeated.add(group.name);
    names.add(group.name);
  }
  return repeated;
});

function groupDisplayName(group: RbacDataAttrGroup) {
  return repeatedNames.value.has(group.name) && group.entityName
    ? `${group.entityName}／${group.name}`
    : group.name;
}
</script>

<template>
  <Popover v-if="groups.length > 0" trigger="click" placement="bottomLeft">
    <template #content>
      <div class="max-h-64 min-w-40 space-y-2 overflow-y-auto" @click.stop>
        <div v-if="!enabled" class="text-muted-foreground text-xs">
          请先勾选操作权限
        </div>
        <div v-for="group in groups" :key="group.permissionExpr">
          <Checkbox
            :checked="
              RbacPermissionMatchUtils.simpleMatchList(
                group.permissionExpr,
                selected,
              )
            "
            :disabled="!enabled"
            :data-test="`attr-group-${group.permissionExpr}`"
            @change="
              emit('toggle', group.permissionExpr, $event.target.checked)
            "
          >
            <Tooltip>
              <template #title>
                <div v-if="group.attributes.length > 0">
                  包含：{{ group.attributes.join('、') }}
                </div>
                <div v-if="group.remark">{{ group.remark }}</div>
              </template>
              <span :data-test="`attr-group-name-${group.permissionExpr}`">{{
                groupDisplayName(group)
              }}</span>
            </Tooltip>
          </Checkbox>
        </div>
      </div>
    </template>
    <button
      class="text-primary ml-2 text-xs"
      type="button"
      data-test="attr-groups-trigger"
      @click.stop.prevent
    >
      属性组
    </button>
  </Popover>
</template>
