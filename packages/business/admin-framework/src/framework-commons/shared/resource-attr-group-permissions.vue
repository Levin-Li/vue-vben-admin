<script lang="ts" setup>
import type { RbacDataAttrGroup } from './data-permission-types';

import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/runtime/icons';

import { Checkbox, Popover, Tooltip } from 'ant-design-vue';

import { RbacPermissionMatchUtils } from '../rbac-permission-match';

const props = defineProps<{
  enabled: boolean;
  groups: RbacDataAttrGroup[];
  inline?: boolean;
  selected: string[];
}>();
const emit = defineEmits<{
  toggle: [expression: string, checked: boolean];
}>();
const groupPopoverOpen = ref(false);

const repeatedNames = computed(() => {
  const names = new Set<string>();
  const repeated = new Set<string>();
  for (const group of props.groups) {
    const name = group.name.replaceAll(/\s+/gu, '');
    if (names.has(name)) repeated.add(name);
    names.add(name);
  }
  return repeated;
});

const selectedGroups = computed(() =>
  props.groups.filter((group) =>
    RbacPermissionMatchUtils.simpleMatchList(
      group.permissionExpr,
      props.selected,
    ),
  ),
);

function getPopupContainer(trigger: HTMLElement) {
  return trigger.parentElement || document.body;
}

function groupDisplayName(group: RbacDataAttrGroup) {
  const name = group.name.replaceAll(/\s+/gu, '');
  return repeatedNames.value.has(name) && group.entityName
    ? `${group.entityName}／${name}`
    : name;
}
</script>

<template>
  <span
    v-if="groups.length > 0 && inline"
    class="ml-3 inline-flex flex-wrap items-center gap-x-3 gap-y-1 align-middle"
    data-test="entity-attr-groups"
    @click.stop
  >
    <span class="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <IconifyIcon
        aria-hidden="true"
        class="size-3.5 shrink-0"
        data-test="attr-group-icon"
        icon="lucide:tags"
      />
      属性组
    </span>
    <Checkbox
      v-for="group in groups"
      :key="group.permissionExpr"
      :checked="
        RbacPermissionMatchUtils.simpleMatchList(group.permissionExpr, selected)
      "
      :disabled="!enabled"
      :data-test="`entity-attr-group-${group.permissionExpr}`"
      @change="emit('toggle', group.permissionExpr, $event.target.checked)"
    >
      <Tooltip>
        <template #title>{{ group.attributes.join('、') }}</template>
        {{ groupDisplayName(group) }}
      </Tooltip>
    </Checkbox>
  </span>
  <span v-else-if="groups.length > 0" class="relative inline-block">
    <Popover
      trigger="click"
      placement="bottomLeft"
      :get-popup-container="getPopupContainer"
      @open-change="groupPopoverOpen = $event"
    >
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
                <template #title>{{ group.attributes.join('、') }}</template>
                <span :data-test="`attr-group-name-${group.permissionExpr}`">{{
                  groupDisplayName(group)
                }}</span>
              </Tooltip>
            </Checkbox>
          </div>
        </div>
      </template>
      <Tooltip
        :mouse-enter-delay="0.7"
        :get-popup-container="getPopupContainer"
        :open="groupPopoverOpen ? false : undefined"
      >
        <template #title>
          <span v-if="selectedGroups.length === 0">未选择属性组</span>
          <span
            v-for="(group, index) in selectedGroups"
            :key="group.permissionExpr"
          >
            <Tooltip
              :title="group.attributes.join('、') || undefined"
              :get-popup-container="getPopupContainer"
            >
              <span
                :data-test="`selected-attr-group-${group.permissionExpr}`"
                v-text="groupDisplayName(group)"
              ></span>
            </Tooltip>
            <span v-if="index < selectedGroups.length - 1">、</span>
          </span>
        </template>
        <button
          class="text-primary ml-2 inline-flex items-center gap-1 text-xs"
          type="button"
          data-test="attr-groups-trigger"
          @click.stop.prevent
        >
          <IconifyIcon
            aria-hidden="true"
            class="size-3.5 shrink-0"
            data-test="attr-group-icon"
            icon="lucide:tags"
          />
          属性组
        </button>
      </Tooltip>
    </Popover>
  </span>
</template>
