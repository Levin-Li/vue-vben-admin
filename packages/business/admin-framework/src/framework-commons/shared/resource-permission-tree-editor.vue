<script lang="ts" setup>
import type {
  RbacMenuNode,
  RbacModuleNode,
  RbacResourceNode,
  RbacTypeNode,
} from './data-permission-types';

import { computed, ref, watch } from 'vue';

import { Checkbox, Radio } from 'ant-design-vue';

import { RbacPermissionMatchUtils } from '../rbac-permission-match';

const props = withDefaults(
  defineProps<{
    menuTree?: RbacMenuNode[];
    modules: RbacModuleNode[];
    selectionMode?: 'multiple' | 'single';
    value: string[];
  }>(),
  {
    menuTree: () => [],
    selectionMode: 'multiple',
  },
);

const emit = defineEmits<{
  'update:value': [string[]];
}>();

const activeModuleId = ref('');
const expandedMenuNodeIds = ref<Set<string>>(new Set());
const keyword = ref('');
const MENU_MODULE_ID = '__menus__';
const MENU_DISPLAY_ACTION = '展示';
const MENU_PERMISSION_TYPE = '系统菜单';
const DEFAULT_MENU_MODULE_ID = 'default';
const DEFAULT_EXPANDED_MENU_DEPTH = 1;

interface MenuPermissionNode {
  children: MenuPermissionNode[];
  depth: number;
  id: string;
  moduleId: string;
  pathText: string;
  permissionExpr: string;
  permissions: string[];
  selfPermission: string;
  title: string;
  type: 'menu' | 'operation';
}

interface VisibleMenuPermissionNode extends MenuPermissionNode {
  ancestorLineIndexes: number[];
  isLastSibling: boolean;
}

const activeModule = computed(
  () =>
    props.modules.find((item) => item.id === activeModuleId.value) ||
    props.modules[0],
);

const isMenuModuleActive = computed(
  () => activeModule.value?.id === MENU_MODULE_ID,
);
const isSingleSelection = computed(() => props.selectionMode === 'single');

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
                actionItem.label,
                actionItem.name,
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

  if (isMenuModuleActive.value) {
    return menuPermissionTree.value.flatMap((node) => node.permissions);
  }

  return (activeModule.value.typeList || []).flatMap((typeItem) =>
    (typeItem.resList || []).flatMap((resourceItem) =>
      (resourceItem.actionList || [])
        .map((actionItem) => actionItem.permissionExpr)
        .filter(Boolean),
    ),
  );
});

const knownMenuPermissions = computed(() => {
  const menuModule = props.modules.find((item) => item.id === MENU_MODULE_ID);
  return new Set(
    (menuModule?.typeList || []).flatMap((typeItem) =>
      (typeItem.resList || []).flatMap((resourceItem) =>
        (resourceItem.actionList || [])
          .map((actionItem) => actionItem.permissionExpr)
          .filter(Boolean),
      ),
    ),
  );
});

const menuPermissionTree = computed(() =>
  buildMenuPermissionTree(props.menuTree || []),
);

const visibleMenuPermissionNodes = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();
  const nodes = normalizedKeyword
    ? filterMenuPermissionTree(menuPermissionTree.value, normalizedKeyword)
    : menuPermissionTree.value;

  return flattenMenuPermissionTree(nodes, Boolean(normalizedKeyword));
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

watch(
  menuPermissionTree,
  (nodes) => {
    expandedMenuNodeIds.value = new Set(getDefaultExpandedMenuNodeIds(nodes));
  },
  {
    immediate: true,
  },
);

function handleToggle(permissionExpr: string, checked: boolean) {
  if (isSingleSelection.value) {
    emit('update:value', checked ? [permissionExpr] : []);
    return;
  }

  const next = checked
    ? [...new Set([permissionExpr, ...props.value])]
    : props.value.filter((item) => item !== permissionExpr);

  emit('update:value', next);
}

function handleTogglePermissions(permissions: string[], checked: boolean) {
  if (isSingleSelection.value) {
    return;
  }

  const validPermissions = permissions.filter(Boolean);
  const next = checked
    ? [...new Set([...validPermissions, ...props.value])]
    : props.value.filter((item) => !validPermissions.includes(item));

  emit('update:value', next);
}

function getMenuTitle(menuItem: RbacMenuNode) {
  return String(menuItem.label || menuItem.name || menuItem.id || '').trim();
}

function buildMenuPermissionExpr(moduleId: string, action: string) {
  return [moduleId, MENU_PERMISSION_TYPE, action, MENU_DISPLAY_ACTION].join(
    ':',
  );
}

function getPermissionActionName(permissionExpr?: null | string) {
  if (!permissionExpr) {
    return '';
  }

  const parts = String(permissionExpr).split(':');

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const value = parts[index]?.trim();
    if (value) {
      return value;
    }
  }

  return String(permissionExpr).trim();
}

function getMenuOperationTitle(
  button: NonNullable<RbacMenuNode['opButtonList']>[number],
) {
  return String(
    button.label ||
      button.name ||
      getPermissionActionName(button.requireAuthorization) ||
      button.apiUrl ||
      '',
  ).trim();
}

function buildMenuOperationNodes(
  menuItem: RbacMenuNode,
  depth: number,
  parentPath: string,
): MenuPermissionNode[] {
  return (menuItem.opButtonList || [])
    .map((button, index) => {
      const permissionExpr = String(button.requireAuthorization || '').trim();
      const title = getMenuOperationTitle(button);

      if (!permissionExpr || button.disabled) {
        return null;
      }

      if (!knownMenuPermissions.value.has(permissionExpr)) {
        return null;
      }

      return {
        children: [],
        depth,
        id: [
          menuItem.id || parentPath || 'menu',
          'op',
          permissionExpr || index,
        ].join('-'),
        moduleId: '',
        pathText: [parentPath, title, button.apiUrl, permissionExpr]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
        permissionExpr,
        permissions: [permissionExpr],
        selfPermission: permissionExpr,
        title,
        type: 'operation' as const,
      };
    })
    .filter(Boolean) as MenuPermissionNode[];
}

function buildMenuPermissionTree(
  menuItems: RbacMenuNode[],
  parentModuleId = DEFAULT_MENU_MODULE_ID,
  depth = 0,
  parentPath = '',
): MenuPermissionNode[] {
  return menuItems
    .map((menuItem, index) => {
      const title = getMenuTitle(menuItem);
      const moduleId = menuItem.moduleId || parentModuleId;
      const permissionExpr = title
        ? buildMenuPermissionExpr(moduleId, title)
        : '';
      const menuChildren = buildMenuPermissionTree(
        menuItem.children || [],
        moduleId,
        depth + 1,
        [parentPath, title].filter(Boolean).join(' / '),
      );
      const operationChildren = buildMenuOperationNodes(
        menuItem,
        depth + 1,
        [parentPath, title].filter(Boolean).join(' / '),
      );
      const children = [...operationChildren, ...menuChildren];
      const selfPermissions =
        permissionExpr && knownMenuPermissions.value.has(permissionExpr)
          ? [permissionExpr]
          : [];
      const childPermissions = children.flatMap((child) => child.permissions);

      return {
        children,
        depth,
        id: menuItem.id || `${parentPath || 'menu'}-${index}`,
        moduleId,
        pathText: [parentPath, title, permissionExpr]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
        permissionExpr,
        permissions: [...selfPermissions, ...childPermissions],
        selfPermission: selfPermissions[0] || '',
        title,
        type: 'menu' as const,
      };
    })
    .filter((node) => node.title && node.permissions.length > 0);
}

function filterMenuPermissionTree(
  nodes: MenuPermissionNode[],
  normalizedKeyword: string,
): MenuPermissionNode[] {
  return nodes
    .map((node) => {
      const children = filterMenuPermissionTree(
        node.children,
        normalizedKeyword,
      );
      const matched = node.pathText.includes(normalizedKeyword);

      if (!matched && children.length === 0) {
        return null;
      }

      const selfPermissions =
        matched && node.selfPermission ? [node.selfPermission] : [];
      const childPermissions = children.flatMap((child) => child.permissions);

      return {
        ...node,
        children,
        permissions: [...selfPermissions, ...childPermissions],
      };
    })
    .filter(Boolean) as MenuPermissionNode[];
}

function flattenMenuPermissionTree(
  nodes: MenuPermissionNode[],
  forceExpanded = false,
) {
  return flattenVisibleMenuPermissionTree(nodes, [], forceExpanded);
}

function flattenVisibleMenuPermissionTree(
  nodes: MenuPermissionNode[],
  ancestorLineIndexes: number[] = [],
  forceExpanded = false,
): VisibleMenuPermissionNode[] {
  const menuNodes = nodes.filter((node) => node.type === 'menu');

  return menuNodes.flatMap((node, index) => {
    const isLastSibling = index === menuNodes.length - 1;
    const expanded =
      forceExpanded || expandedMenuNodeIds.value.has(node.id) || !hasMenuChildren(node);
    const childAncestorLineIndexes = isLastSibling
      ? ancestorLineIndexes
      : [...ancestorLineIndexes, node.depth];

    return [
      {
        ...node,
        ancestorLineIndexes,
        isLastSibling,
      },
      ...(expanded
        ? flattenVisibleMenuPermissionTree(
            node.children,
            childAncestorLineIndexes,
            forceExpanded,
          )
        : []),
    ];
  });
}

function getMenuOperationChildren(node: MenuPermissionNode) {
  return node.children.filter((child) => child.type === 'operation');
}

function getMenuChildren(node: MenuPermissionNode) {
  return node.children.filter((child) => child.type === 'menu');
}

function hasMenuChildren(node: MenuPermissionNode) {
  return getMenuChildren(node).length > 0;
}

function getDefaultExpandedMenuNodeIds(nodes: MenuPermissionNode[]) {
  return nodes.flatMap((node): string[] => {
    const current =
      node.depth <= DEFAULT_EXPANDED_MENU_DEPTH && hasMenuChildren(node)
        ? [node.id]
        : [];

    return [...current, ...getDefaultExpandedMenuNodeIds(getMenuChildren(node))];
  });
}

function isMenuNodeExpanded(node: MenuPermissionNode) {
  return expandedMenuNodeIds.value.has(node.id);
}

function toggleMenuNodeExpanded(node: MenuPermissionNode) {
  const next = new Set(expandedMenuNodeIds.value);

  if (next.has(node.id)) {
    next.delete(node.id);
  } else {
    next.add(node.id);
  }

  expandedMenuNodeIds.value = next;
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
  label?: null | string;
  name?: null | string;
  permissionExpr: string;
}) {
  return (
    actionItem.id || actionItem.permissionExpr || actionItem.action || 'unknown'
  );
}

function getActionDisplayName(actionItem: {
  action?: string;
  id?: null | string;
  label?: null | string;
  name?: null | string;
  permissionExpr: string;
}) {
  return (
    actionItem.label ||
    actionItem.action ||
    actionItem.name ||
    actionItem.id ||
    getPermissionActionName(actionItem.permissionExpr)
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

function isSomeSelected(permissions: string[]) {
  return permissions.some((permission) => isActionSelected(permission));
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
      class="bg-card space-y-4 rounded-2xl p-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <Checkbox
            v-if="!isSingleSelection"
            :checked="isAllSelected(activeModulePermissions)"
            :indeterminate="
              isSomeSelected(activeModulePermissions) &&
              !isAllSelected(activeModulePermissions)
            "
            data-test="permission-module-toggle"
            @change="
              handleTogglePermissions(
                activeModulePermissions,
                ($event.target as HTMLInputElement).checked,
              )
            "
          >
            <span class="text-foreground text-base font-semibold">
              {{ activeModule.name || activeModule.id }}
            </span>
          </Checkbox>
          <span v-else class="text-foreground text-base font-semibold">
            {{ activeModule.name || activeModule.id }}
          </span>
          <div class="text-muted-foreground text-xs">
            已选 {{ activeSelectedCount }} /
            {{ activeModulePermissions.length }}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            class="border-border bg-background placeholder:text-muted-foreground focus:border-primary focus:ring-primary/10 w-full max-w-xs rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
            data-test="permission-search"
            placeholder="搜索动作、资源或权限表达式"
            type="text"
          />
        </div>
      </div>

      <div v-if="isMenuModuleActive" class="space-y-1">
        <div
          v-for="node in visibleMenuPermissionNodes"
          :key="node.id"
          class="hover:bg-muted/40 relative rounded-lg py-2 pl-3 pr-3 transition"
        >
          <span
            v-for="lineDepth in node.ancestorLineIndexes"
            :key="lineDepth"
            class="border-border/80 pointer-events-none absolute bottom-0 top-0 border-l border-dashed"
            :style="{ left: `${23 + lineDepth * 36}px` }"
          ></span>
          <span
            v-if="node.depth > 0"
            class="border-border/80 pointer-events-none absolute border-l border-t border-dashed"
            :class="node.isLastSibling ? 'h-1/2 top-0' : 'bottom-0 top-0'"
            :style="{
              left: `${23 + (node.depth - 1) * 36}px`,
              width: '24px',
            }"
          ></span>

          <div
            class="relative flex items-start gap-1"
            :style="{ paddingLeft: `${node.depth * 36}px` }"
          >
            <button
              v-if="hasMenuChildren(node)"
              :aria-expanded="isMenuNodeExpanded(node)"
              :aria-label="isMenuNodeExpanded(node) ? '收起菜单' : '展开菜单'"
              :data-test="`permission-menu-expand-${node.id}`"
              class="text-muted-foreground hover:bg-muted hover:text-foreground mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded transition"
              type="button"
              @click="toggleMenuNodeExpanded(node)"
            >
              <span
                class="text-xs leading-none transition-transform"
                :class="isMenuNodeExpanded(node) ? 'rotate-90' : ''"
              >
                ▶
              </span>
            </button>
            <span v-else class="mt-0.5 size-5 shrink-0"></span>

            <div class="min-w-0 flex-1">
              <Checkbox
                :checked="isAllSelected(node.permissions)"
                :indeterminate="
                  isSomeSelected(node.permissions) &&
                  !isAllSelected(node.permissions)
                "
                :data-test="`permission-${node.permissionExpr}`"
                @change="
                  handleTogglePermissions(
                    node.permissions,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              >
                <span class="text-foreground text-sm font-medium">
                  {{ node.title }}
                </span>
                <span
                  v-if="node.children.length > 0"
                  class="text-muted-foreground ml-2 text-xs"
                >
                  {{ node.children.length }} 项
                </span>
              </Checkbox>

              <div
                v-if="getMenuOperationChildren(node).length > 0"
                class="mt-3 pl-10"
              >
                <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <span
                    class="text-muted-foreground inline-flex h-6 items-center text-xs font-medium"
                  >
                    操作
                  </span>
                  <Checkbox
                    v-for="operationNode in getMenuOperationChildren(node)"
                    :key="operationNode.id"
                    :checked="isActionSelected(operationNode.permissionExpr)"
                    :data-test="`permission-${operationNode.permissionExpr}`"
                    @change="
                      handleToggle(
                        operationNode.permissionExpr,
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  >
                    <span
                      class="inline-block max-w-[12rem] truncate align-bottom"
                      :title="operationNode.title"
                    >
                      {{ operationNode.title }}
                    </span>
                  </Checkbox>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <div
          v-for="typeItem in filteredTypeList"
          :key="typeItem.id"
          class="bg-muted/30 rounded-2xl p-4"
        >
          <div class="mb-3 flex items-center gap-2">
            <Checkbox
              v-if="!isSingleSelection"
              :checked="isAllSelected(getTypePermissions(typeItem))"
              :indeterminate="
                isSomeSelected(getTypePermissions(typeItem)) &&
                !isAllSelected(getTypePermissions(typeItem))
              "
              @change="
                handleTogglePermissions(
                  getTypePermissions(typeItem),
                  ($event.target as HTMLInputElement).checked,
                )
              "
            >
              <span class="bg-primary h-4 w-1 rounded-full"></span>
              <span class="text-foreground text-[15px] font-semibold">
                {{ typeItem.name || typeItem.id }}
              </span>
            </Checkbox>
            <template v-else>
              <span class="bg-primary h-4 w-1 rounded-full"></span>
              <span class="text-foreground text-[15px] font-semibold">
                {{ typeItem.name || typeItem.id }}
              </span>
            </template>
          </div>

          <div class="space-y-3 pl-4">
            <div
              v-for="(resourceItem, resourceIndex) in typeItem.resList || []"
              :key="getResourceKey(resourceItem, resourceIndex)"
              class="bg-card rounded-xl px-4 py-3"
            >
              <div
                v-if="getResourceName(resourceItem)"
                class="mb-2 flex items-center gap-2"
              >
                <Checkbox
                  v-if="!isSingleSelection"
                  :checked="isAllSelected(getResourcePermissions(resourceItem))"
                  :indeterminate="
                    isSomeSelected(getResourcePermissions(resourceItem)) &&
                    !isAllSelected(getResourcePermissions(resourceItem))
                  "
                  @change="
                    handleTogglePermissions(
                      getResourcePermissions(resourceItem),
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                >
                  <span class="text-muted-foreground text-sm font-medium">
                    {{ getResourceName(resourceItem) }}
                  </span>
                </Checkbox>
                <span v-else class="text-muted-foreground text-sm font-medium">
                  {{ getResourceName(resourceItem) }}
                </span>
              </div>

              <div
                class="flex flex-wrap gap-x-6 gap-y-3"
                :class="getResourceName(resourceItem) ? 'pl-6' : ''"
              >
                <component
                  :is="isSingleSelection ? Radio : Checkbox"
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
                    :title="getActionDisplayName(actionItem) || undefined"
                  >
                    {{ getActionDisplayName(actionItem) }}
                  </span>
                </component>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div
        v-if="
          isMenuModuleActive
            ? visibleMenuPermissionNodes.length === 0
            : filteredTypeList.length === 0
        "
        class="text-muted-foreground rounded-2xl px-4 py-8 text-center text-sm"
      >
        没有匹配的权限
      </div>
    </div>
  </div>
</template>
