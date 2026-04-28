<script lang="ts" setup>
import type {
  RbacModuleNode,
  RbacResourceNode,
  RbacTypeNode,
} from './data-permission-types';

import { computed, ref, watch } from 'vue';

import { Checkbox } from 'ant-design-vue';

import { RbacPermissionMatchUtils } from '#/utils/rbac-permission-match';

const props = defineProps<{
  modules: RbacModuleNode[];
  value: string[];
}>();

const emit = defineEmits<{
  'update:value': [string[]];
}>();

const activeModuleId = ref('');
const keyword = ref('');

const activeModule = computed(
  () =>
    props.modules.find((item) => item.id === activeModuleId.value) ||
    props.modules[0],
);

function sortTypeList<T extends { id?: string; name?: string }>(items: T[]) {
  return items.toSorted((left, right) =>
    (left.name || left.id || '').localeCompare(
      right.name || right.id || '',
      'zh-CN',
    ),
  );
}

const filteredTypeList = computed(() => {
  if (!activeModule.value) {
    return [];
  }

  const normalizedKeyword = keyword.value.trim().toLowerCase();
  if (!normalizedKeyword) {
    return sortTypeList(activeModule.value.typeList || []);
  }

  const filtered = (activeModule.value.typeList || [])
    .map((typeItem) => {
      const filteredResources = (typeItem.resList || [])
        .map((resourceItem) => {
          const filteredActions = (resourceItem.actionList || []).filter(
            (actionItem) => {
              const haystacks = [
                typeItem.name,
                resourceItem.name,
                actionItem.action,
                actionItem.permissionExpr,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

              return haystacks.includes(normalizedKeyword);
            },
          );

          return {
            ...resourceItem,
            actionList: filteredActions,
          };
        })
        .filter((resourceItem) => (resourceItem.actionList || []).length > 0);

      return {
        ...typeItem,
        resList: filteredResources,
      };
    })
    .filter((typeItem) => (typeItem.resList || []).length > 0);

  return sortTypeList(filtered);
});

const activeModulePermissions = computed(() => {
  if (!activeModule.value) {
    return [];
  }

  return (activeModule.value.typeList || []).flatMap((typeItem) =>
    (typeItem.resList || []).flatMap((resourceItem) =>
      (resourceItem.actionList || [])
        .map((actionItem) => actionItem.permissionExpr)
        .filter(Boolean),
    ),
  );
});

const activeSelectedCount = computed(
  () =>
    activeModulePermissions.value.filter((permission) =>
      RbacPermissionMatchUtils.simpleMatchList(permission, props.value),
    ).length,
);

watch(
  () => props.modules,
  (modules) => {
    if (!modules.some((item) => item.id === activeModuleId.value)) {
      activeModuleId.value = modules[0]?.id || '';
    }
  },
  {
    immediate: true,
  },
);

watch(activeModuleId, () => {
  keyword.value = '';
});

function handleToggle(permissionExpr: string, checked: boolean) {
  const next = checked
    ? [...new Set([permissionExpr, ...props.value])]
    : props.value.filter((item) => item !== permissionExpr);

  emit('update:value', next);
}

function handleTogglePermissions(permissions: string[], checked: boolean) {
  const validPermissions = permissions.filter(Boolean);
  const next = checked
    ? [...new Set([...validPermissions, ...props.value])]
    : props.value.filter((item) => !validPermissions.includes(item));

  emit('update:value', next);
}

function getResourcePermissions(resourceItem: RbacResourceNode) {
  return (resourceItem.actionList || [])
    .map((actionItem) => actionItem.permissionExpr)
    .filter(Boolean);
}

function getTypePermissions(typeItem: RbacTypeNode) {
  return (typeItem.resList || []).flatMap((resourceItem) =>
    getResourcePermissions(resourceItem),
  );
}

function getResourceName(resourceItem: {
  domain?: string;
  id?: null | string;
  name?: null | string;
  type?: string;
}) {
  return String(resourceItem.name || '').trim();
}

function getResourceKey(
  resourceItem: {
    domain?: string;
    id?: null | string;
    name?: null | string;
    type?: string;
  },
  resourceIndex: number,
) {
  return (
    [
      resourceItem.domain,
      resourceItem.type,
      resourceItem.id,
      getResourceName(resourceItem),
    ]
      .filter(Boolean)
      .join('|') || `resource-${resourceIndex}`
  );
}

function getActionKey(actionItem: {
  action?: string;
  id?: null | string;
  permissionExpr: string;
}) {
  return (
    actionItem.id || actionItem.permissionExpr || actionItem.action || 'unknown'
  );
}

function isActionSelected(permissionExpr: string) {
  return RbacPermissionMatchUtils.simpleMatchList(permissionExpr, props.value);
}

function isAllSelected(permissions: string[]) {
  return (
    permissions.length > 0 &&
    permissions.every((permission) => isActionSelected(permission))
  );
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap gap-2">
      <div
        v-for="moduleItem in modules"
        :key="moduleItem.id"
        :class="
          activeModuleId === moduleItem.id
            ? 'border-primary bg-primary/5 text-primary shadow-sm'
            : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted'
        "
        data-test="permission-module-tab"
        class="cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition"
        @click="activeModuleId = moduleItem.id"
      >
        {{ moduleItem.name || moduleItem.id }}
      </div>
    </div>

    <div
      v-if="activeModule"
      :key="activeModule.id"
      class="space-y-4 rounded-2xl bg-card p-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <Checkbox
            :checked="isAllSelected(activeModulePermissions)"
            data-test="permission-module-toggle"
            @change="
              handleTogglePermissions(
                activeModulePermissions,
                ($event.target as HTMLInputElement).checked,
              )
            "
          >
            <span class="text-base font-semibold text-foreground">
              {{ activeModule.name || activeModule.id }}
            </span>
          </Checkbox>
          <div class="text-xs text-muted-foreground">
            已选 {{ activeSelectedCount }} /
            {{ activeModulePermissions.length }}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            class="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
            data-test="permission-search"
            placeholder="搜索动作、资源或权限表达式"
            type="text"
          />
        </div>
      </div>

      <div
        v-for="typeItem in filteredTypeList"
        :key="typeItem.id"
        class="rounded-2xl bg-muted/30 p-4"
      >
        <div class="mb-3 flex items-center gap-2">
          <Checkbox
            :checked="isAllSelected(getTypePermissions(typeItem))"
            @change="
              handleTogglePermissions(
                getTypePermissions(typeItem),
                ($event.target as HTMLInputElement).checked,
              )
            "
          >
            <span class="h-4 w-1 rounded-full bg-primary"></span>
            <span class="text-[15px] font-semibold text-foreground">
              {{ typeItem.name || typeItem.id }}
            </span>
          </Checkbox>
        </div>

        <div class="space-y-3 pl-4">
          <div
            v-for="(resourceItem, resourceIndex) in typeItem.resList || []"
            :key="getResourceKey(resourceItem, resourceIndex)"
            class="rounded-xl bg-card px-4 py-3"
          >
            <div
              v-if="getResourceName(resourceItem)"
              class="mb-2 flex items-center gap-2"
            >
              <Checkbox
                :checked="isAllSelected(getResourcePermissions(resourceItem))"
                @change="
                  handleTogglePermissions(
                    getResourcePermissions(resourceItem),
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              >
                <span class="text-sm font-medium text-muted-foreground">
                  {{ getResourceName(resourceItem) }}
                </span>
              </Checkbox>
            </div>

            <div
              class="flex flex-wrap gap-x-6 gap-y-3"
              :class="getResourceName(resourceItem) ? 'pl-6' : ''"
            >
              <Checkbox
                v-for="actionItem in resourceItem.actionList || []"
                :key="getActionKey(actionItem)"
                :checked="isActionSelected(actionItem.permissionExpr)"
                :data-test="`permission-${actionItem.permissionExpr}`"
                @change="
                  handleToggle(
                    actionItem.permissionExpr,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              >
                <span
                  class="truncate"
                  :title="actionItem.action || actionItem.id || undefined"
                >
                  {{ actionItem.action || actionItem.id }}
                </span>
              </Checkbox>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="filteredTypeList.length === 0"
        class="rounded-2xl px-4 py-8 text-center text-sm text-muted-foreground"
      >
        没有匹配的权限
      </div>
    </div>
  </div>
</template>
