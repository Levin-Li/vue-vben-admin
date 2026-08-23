<script lang="ts" setup>
import type {
  PermissionTreeNode,
  PermissionTreeNodeType,
  RbacMenuNode,
  RbacModuleNode,
  RbacResourceNode,
  RbacTypeNode,
} from './data-permission-types';

import { PermissionTreeNodeType as PermissionTreeNodeTypeEnum } from './data-permission-types';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Checkbox, Radio, Tooltip } from 'ant-design-vue';

import { RbacPermissionMatchUtils } from '../rbac-permission-match';

const props = withDefaults(
  defineProps<{
    menuTree?: RbacMenuNode[];
    modules?: RbacModuleNode[];
    permissionTree?: PermissionTreeNode[];
    selectionMode?: 'multiple' | 'single';
    value: string[];
  }>(),
  {
    menuTree: () => [],
    modules: () => [],
    permissionTree: () => [],
    selectionMode: 'multiple',
  },
);

const emit = defineEmits<{
  'update:value': [string[]];
}>();

const activeModuleId = ref('');
const activePermissionRootId = ref('');
const expandedPermissionNodeIds = ref<Set<string>>(new Set());
const expandedMenuNodeIds = ref<Set<string>>(new Set());
const keyword = ref('');
const MENU_MODULE_ID = '__menus__';
const MENU_DISPLAY_ACTION = '展示';
const MENU_PERMISSION_TYPE = '系统数据-系统菜单';
const DEFAULT_MENU_MODULE_ID = 'default';
const DEFAULT_EXPANDED_MENU_DEPTH = 1;
const MENU_TREE_ROW_PADDING_LEFT = 12;
const MENU_TREE_INDENT_SIZE = 36;
const MENU_TREE_SWITCHER_SIZE = 20;
const MENU_TREE_NODE_GAP = 4;
const MENU_TREE_CHECKBOX_SIZE = 16;

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

interface PermissionViewNode {
  children: PermissionViewNode[];
  depth: number;
  id: string;
  label: string;
  nodeType: `${PermissionTreeNodeType}`;
  pathText: string;
  permissionExpr: string;
  permissions: string[];
  remark: string;
  title: string;
}

interface VisiblePermissionViewNode extends PermissionViewNode {
  ancestorLineIndexes: number[];
  isLastSibling: boolean;
}

const hasPermissionTree = computed(() => props.permissionTree.length > 0);

const activeModule = computed(() => {
  if (hasPermissionTree.value) {
    return undefined;
  }

  return (
    props.modules.find((item) => item.id === activeModuleId.value) ||
    props.modules[0]
  );
});

const isMenuModuleActive = computed(
  () => activeModule.value?.id === MENU_MODULE_ID,
);
const isSingleSelection = computed(() => props.selectionMode === 'single');
const activeModuleTitle = computed(
  () => activeModule.value?.name || activeModule.value?.id || '',
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

const menuPermissionViewTree = computed(() =>
  convertMenuPermissionTreeToViewTree(menuPermissionTree.value),
);

const permissionViewTree = computed(() => {
  const viewTree = buildPermissionViewTree(props.permissionTree || []);

  if (menuPermissionViewTree.value.length === 0) {
    return viewTree;
  }

  return viewTree.map((node) =>
    node.id === MENU_MODULE_ID && shouldUseLegacyMenuPermissionTree(node)
      ? {
          ...node,
          children: menuPermissionViewTree.value,
          permissions: getPermissionNodePermissions(
            menuPermissionViewTree.value,
          ),
        }
      : node,
  );
});

const activePermissionRoot = computed(
  () =>
    permissionViewTree.value.find(
      (node) => node.id === activePermissionRootId.value,
    ) || permissionViewTree.value[0],
);

const activePermissionViewTree = computed(() => {
  const root = activePermissionRoot.value;

  if (!root) {
    return [];
  }

  return shiftPermissionViewTreeDepth(root.children, root.depth);
});

const visiblePermissionNodes = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();
  const nodes = normalizedKeyword
    ? filterPermissionViewTree(
        activePermissionViewTree.value,
        normalizedKeyword,
      )
    : activePermissionViewTree.value;

  return flattenPermissionViewTree(nodes, Boolean(normalizedKeyword));
});

const activeRootInlinePermissionNodes = computed(() =>
  activePermissionViewTree.value.filter(
    (node) => isInlinePermissionNode(node) && Boolean(node.permissionExpr),
  ),
);

const activeTabPermissions = computed(() =>
  hasPermissionTree.value
    ? getPermissionNodePermissions(activePermissionViewTree.value)
    : activeModulePermissions.value,
);

const activeSelectedCount = computed(() => {
  return activeTabPermissions.value.filter((permission) =>
    RbacPermissionMatchUtils.simpleMatchList(permission, props.value),
  ).length;
});

const activePermissionCount = computed(() => activeTabPermissions.value.length);

const activeUnselectedCount = computed(() =>
  Math.max(activePermissionCount.value - activeSelectedCount.value, 0),
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
  permissionViewTree,
  (nodes) => {
    if (!nodes.some((node) => node.id === activePermissionRootId.value)) {
      activePermissionRootId.value = nodes[0]?.id || '';
    }

    expandedPermissionNodeIds.value = new Set(
      getDefaultExpandedPermissionNodeIds(nodes),
    );
  },
  {
    immediate: true,
  },
);

watch(
  menuPermissionTree,
  (nodes) => {
    expandedMenuNodeIds.value = new Set(getDefaultExpandedMenuNodeIds(nodes));
  },
  {
    immediate: true,
  },
);

watch(activePermissionRootId, () => {
  if (hasPermissionTree.value) {
    keyword.value = '';
  }
});

function normalizePermissionExpr(permissionExpr?: string) {
  return String(permissionExpr || '').trim();
}

function isValidPermissionExpr(permissionExpr?: string) {
  const normalized = normalizePermissionExpr(permissionExpr);
  if (!normalized) {
    return true;
  }

  const parts = normalized.split(':');
  return parts.length === 4 && Boolean(parts[0] && parts[1] && parts[3]);
}

function handleToggle(
  permissionExpr: string,
  checked: boolean,
  parentPermissionExpr = '',
) {
  const normalizedPermissionExpr = normalizePermissionExpr(permissionExpr);
  if (!normalizedPermissionExpr || !isValidPermissionExpr(normalizedPermissionExpr)) {
    if (checked) {
      emit(
        'update:value',
        props.value.filter((item) => item !== permissionExpr),
      );
    }
    return;
  }

  if (isSingleSelection.value) {
    emit('update:value', checked ? [normalizedPermissionExpr] : []);
    return;
  }

  let next = checked
    ? [...new Set([normalizedPermissionExpr, ...props.value])]
    : props.value.filter((item) => item !== normalizedPermissionExpr);

  const normalizedParentPermissionExpr = normalizePermissionExpr(
    parentPermissionExpr,
  );
  if (
    normalizedParentPermissionExpr &&
    normalizedParentPermissionExpr !== normalizedPermissionExpr &&
    isValidPermissionExpr(normalizedParentPermissionExpr) &&
    !next.includes(normalizedParentPermissionExpr)
  ) {
    next = [normalizedParentPermissionExpr, ...next];
  }

  emit('update:value', next);
}

function handleTogglePermissions(permissions: string[], checked: boolean) {
  if (isSingleSelection.value) {
    return;
  }

  const validPermissions = permissions
    .map(normalizePermissionExpr)
    .filter((permission) => permission && isValidPermissionExpr(permission));
  const next = checked
    ? [...new Set([...validPermissions, ...props.value])]
    : props.value.filter((item) => !validPermissions.includes(item));

  emit('update:value', next);
}

function buildPermissionViewTree(
  nodes: PermissionTreeNode[],
  depth = 0,
  parentPath = '',
): PermissionViewNode[] {
  return nodes.filter(Boolean).flatMap((node, index) => {
    const label = String(node.label || '').trim();
    const title = String(label || node.name || node.id || '').trim();
    const permissionExpr = String(node.permissionExpr || '').trim();
    const remark = String(node.remark || '').trim();
    const nodeType = node.nodeType;
    const children = isInlinePermissionNodeType(nodeType)
      ? []
      : buildPermissionViewTree(
          node.children || [],
          depth + 1,
          [parentPath, title].filter(Boolean).join(' / '),
        );
    const permissions = [
      ...(permissionExpr ? [permissionExpr] : []),
      ...getPermissionNodePermissions(children),
    ];

    if (!title && !permissionExpr && !isInlinePermissionNodeType(nodeType)) {
      return shiftPermissionViewTreeDepth(children, 1);
    }

    return [
      {
        children,
        depth,
        id: String(node.id || `${parentPath || 'permission'}-${index}`),
        label,
        nodeType,
        pathText: [parentPath, title, label, node.name, nodeType, permissionExpr]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
        permissionExpr,
        permissions,
        remark,
        title,
      },
    ];
  });
}

function shouldUseLegacyMenuPermissionTree(node: PermissionViewNode) {
  if (node.children.length === 0) {
    return true;
  }

  return node.children.some((child) =>
    [
      PermissionTreeNodeTypeEnum.Module,
      PermissionTreeNodeTypeEnum.Resource,
      PermissionTreeNodeTypeEnum.ResourceType,
    ].includes(child.nodeType as PermissionTreeNodeTypeEnum),
  );
}

function filterPermissionViewTree(
  nodes: PermissionViewNode[],
  normalizedKeyword: string,
): PermissionViewNode[] {
  return nodes
    .map((node) => {
      const children = filterPermissionViewTree(
        node.children,
        normalizedKeyword,
      );
      const matched = node.pathText.includes(normalizedKeyword);

      if (!matched && children.length === 0) {
        return null;
      }

      return {
        ...node,
        children,
        permissions: [
          ...(node.permissionExpr ? [node.permissionExpr] : []),
          ...getPermissionNodePermissions(children),
        ],
      };
    })
    .filter(Boolean) as PermissionViewNode[];
}

function shiftPermissionViewTreeDepth(
  nodes: PermissionViewNode[],
  depthOffset: number,
): PermissionViewNode[] {
  return nodes.map((node) => ({
    ...node,
    children: shiftPermissionViewTreeDepth(node.children, depthOffset),
    depth: Math.max(0, node.depth - depthOffset),
  }));
}

function flattenPermissionViewTree(
  nodes: PermissionViewNode[],
  forceExpanded = false,
) {
  return flattenVisiblePermissionViewTree(nodes, [], forceExpanded);
}

function flattenVisiblePermissionViewTree(
  nodes: PermissionViewNode[],
  ancestorLineIndexes: number[] = [],
  forceExpanded = false,
): VisiblePermissionViewNode[] {
  const treeNodes = nodes.filter((node) => !isInlinePermissionNode(node));

  return treeNodes.flatMap((node, index) => {
    const isLastSibling = index === treeNodes.length - 1;
    const expanded =
      forceExpanded ||
      expandedPermissionNodeIds.value.has(node.id) ||
      !hasPermissionChildren(node);
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
        ? flattenVisiblePermissionViewTree(
            getPermissionTreeChildren(node),
            childAncestorLineIndexes,
            forceExpanded,
          )
        : []),
    ];
  });
}

function getPermissionNodePermissions(nodes: PermissionViewNode[]) {
  return nodes.flatMap((node) => node.permissions).filter(Boolean);
}

function hasPermissionChildren(node: PermissionViewNode) {
  return getPermissionTreeChildren(node).length > 0;
}

function hasOwnPermissionMarker(node: PermissionViewNode) {
  const permissionExpr = normalizePermissionExpr(node.permissionExpr);
  return (
    (hasPermissionChildren(node) ||
      getPermissionInlineChildren(node).length > 0) &&
    Boolean(permissionExpr) &&
    isValidPermissionExpr(permissionExpr)
  );
}

function isPermissionNodeExpanded(node: PermissionViewNode) {
  return expandedPermissionNodeIds.value.has(node.id);
}

function togglePermissionNodeExpanded(node: PermissionViewNode) {
  const next = new Set(expandedPermissionNodeIds.value);

  if (next.has(node.id)) {
    next.delete(node.id);
  } else {
    next.add(node.id);
  }

  expandedPermissionNodeIds.value = next;
}

function getDefaultExpandedPermissionNodeIds(nodes: PermissionViewNode[]) {
  return nodes.flatMap((node): string[] => {
    const current =
      node.depth <= DEFAULT_EXPANDED_MENU_DEPTH && hasPermissionChildren(node)
        ? [node.id]
        : [];

    return [
      ...current,
      ...getDefaultExpandedPermissionNodeIds(getPermissionTreeChildren(node)),
    ];
  });
}

function isInlinePermissionNode(node: PermissionViewNode) {
  return isInlinePermissionNodeType(node.nodeType);
}

function isInlinePermissionNodeType(nodeType?: string) {
  return (
    nodeType === PermissionTreeNodeTypeEnum.Action ||
    nodeType === PermissionTreeNodeTypeEnum.Permission
  );
}

function getPermissionInlineChildren(node: PermissionViewNode) {
  return node.children.filter(
    (child) => isInlinePermissionNode(child) && Boolean(child.permissionExpr),
  );
}

function getPermissionTreeChildren(node: PermissionViewNode) {
  return node.children.filter((child) => !isInlinePermissionNode(child));
}

function getPermissionRowClass(node: VisiblePermissionViewNode) {
  if (node.depth === 0) {
    return 'bg-muted/20';
  }

  if (getPermissionInlineChildren(node).length > 0) {
    return 'bg-background';
  }

  return 'bg-transparent';
}

function getPermissionNodeTypeIcon(nodeType?: string) {
  const iconMap: Partial<Record<`${PermissionTreeNodeType}`, string>> = {
    [PermissionTreeNodeTypeEnum.Action]: 'lucide:mouse-pointer-click',
    [PermissionTreeNodeTypeEnum.Group]: 'lucide:folder-tree',
    [PermissionTreeNodeTypeEnum.Menu]: 'lucide:panel-right-open',
    [PermissionTreeNodeTypeEnum.Module]: 'lucide:box',
    [PermissionTreeNodeTypeEnum.Permission]: 'lucide:key-round',
    [PermissionTreeNodeTypeEnum.Resource]: 'lucide:file-text',
    [PermissionTreeNodeTypeEnum.ResourceType]: 'lucide:layers-3',
  };

  return (
    iconMap[nodeType as `${PermissionTreeNodeType}`] || 'lucide:circle-dot'
  );
}

function getMenuPermissionNodeIcon(node: MenuPermissionNode) {
  return node.type === 'operation'
    ? getPermissionNodeTypeIcon(PermissionTreeNodeTypeEnum.Action)
    : getPermissionNodeTypeIcon(PermissionTreeNodeTypeEnum.Menu);
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
      const selfPermissions = permissionExpr ? [permissionExpr] : [];
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

function convertMenuPermissionTreeToViewTree(
  nodes: MenuPermissionNode[],
): PermissionViewNode[] {
  return nodes.map((node) => {
    const children = convertMenuPermissionTreeToViewTree(node.children);
    const nodeType =
      node.type === 'operation'
        ? PermissionTreeNodeTypeEnum.Action
        : PermissionTreeNodeTypeEnum.Menu;

    return {
      children,
      depth: node.depth + 1,
      id: node.id,
      label: node.title,
      nodeType,
      pathText: [
        node.pathText,
        nodeType,
        node.selfPermission,
        node.permissionExpr,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      permissionExpr: node.selfPermission || node.permissionExpr,
      permissions: node.permissions,
      remark: '',
      title: node.title,
    };
  });
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

      const selfPermissions = node.selfPermission ? [node.selfPermission] : [];
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
      forceExpanded ||
      expandedMenuNodeIds.value.has(node.id) ||
      !hasMenuChildren(node);
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

function getMenuPermissionRowClass(node: VisibleMenuPermissionNode) {
  if (node.depth === 0) {
    return 'bg-muted/20';
  }

  if (getMenuOperationChildren(node).length > 0) {
    return 'bg-background';
  }

  return 'bg-transparent';
}

function getDefaultExpandedMenuNodeIds(nodes: MenuPermissionNode[]) {
  return nodes.flatMap((node): string[] => {
    const current =
      node.depth <= DEFAULT_EXPANDED_MENU_DEPTH && hasMenuChildren(node)
        ? [node.id]
        : [];

    return [
      ...current,
      ...getDefaultExpandedMenuNodeIds(getMenuChildren(node)),
    ];
  });
}

function getMenuTreeGuideLineLeft(depth: number) {
  return `${
    MENU_TREE_ROW_PADDING_LEFT +
    depth * MENU_TREE_INDENT_SIZE +
    MENU_TREE_SWITCHER_SIZE +
    MENU_TREE_NODE_GAP +
    MENU_TREE_CHECKBOX_SIZE / 2
  }px`;
}

function getMenuTreeNodePaddingLeft(depth: number) {
  return `${depth * MENU_TREE_INDENT_SIZE}px`;
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

function isPermissionNodeSelected(
  _permissionExpr: string,
  permissions: string[],
) {
  return isSomeSelected(permissions);
}

function isPermissionNodeIndeterminate(
  _permissionExpr: string,
  _permissions: string[],
) {
  return false;
}

function getSelectedPermissionCount(permissions: string[]) {
  return permissions.filter((permission) => isActionSelected(permission))
    .length;
}

function getPermissionCountText(permissions: string[]) {
  return `${getSelectedPermissionCount(permissions)}/${permissions.length}`;
}
</script>

<template>
  <div class="permission-tree-editor space-y-5">
    <div v-if="!hasPermissionTree" class="flex flex-wrap gap-2">
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
      v-if="hasPermissionTree || activeModule"
      :key="hasPermissionTree ? 'permission-tree' : activeModule?.id"
      class="bg-card space-y-4 rounded-2xl p-4"
    >
      <div v-if="hasPermissionTree" class="flex flex-wrap gap-2">
        <button
          v-for="rootNode in permissionViewTree"
          :key="rootNode.id"
          :class="
            activePermissionRoot?.id === rootNode.id
              ? 'border-primary bg-primary/5 text-primary shadow-sm'
              : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted'
          "
          :title="rootNode.title || undefined"
          :data-test="`permission-root-tab-${rootNode.id}`"
          class="cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition"
          type="button"
          @click="activePermissionRootId = rootNode.id"
        >
          {{ rootNode.title || rootNode.id }}
          <span
            v-if="rootNode.children.length > 0"
            class="ml-1 text-xs opacity-75"
          >
            {{ rootNode.children.length }} 项
          </span>
        </button>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <Checkbox
            v-if="!isSingleSelection && hasPermissionTree"
            :checked="isAllSelected(activeTabPermissions)"
            :indeterminate="
              isSomeSelected(activeTabPermissions) &&
              !isAllSelected(activeTabPermissions)
            "
            data-test="permission-tree-toggle"
            @change="
              handleTogglePermissions(
                activeTabPermissions,
                ($event.target as HTMLInputElement).checked,
              )
            "
          >
            <span class="text-foreground text-sm font-medium">
              已选 {{ activeSelectedCount }}
              <span class="text-muted-foreground ml-2">
                未选 {{ activeUnselectedCount }}
              </span>
            </span>
          </Checkbox>
          <Checkbox
            v-else-if="!isSingleSelection && activeModule"
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
              {{ activeModuleTitle }}
            </span>
          </Checkbox>
          <span
            v-else-if="hasPermissionTree"
            class="text-foreground text-sm font-medium"
          >
            已选 {{ activeSelectedCount }}
            <span class="text-muted-foreground ml-2">
              未选 {{ activeUnselectedCount }}
            </span>
          </span>
          <span
            v-else-if="activeModule"
            class="text-foreground text-base font-semibold"
          >
            {{ activeModuleTitle }}
          </span>
          <div v-if="!hasPermissionTree" class="text-muted-foreground text-xs">
            已选 {{ activeSelectedCount }} /
            {{ activePermissionCount }}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            class="border-border bg-background placeholder:text-muted-foreground focus:border-primary focus:ring-primary/10 w-full max-w-xs rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
            data-test="permission-search"
            :placeholder="
              hasPermissionTree
                ? '搜索节点、备注或权限表达式'
                : '搜索动作、资源或权限表达式'
            "
            type="text"
          />
        </div>
      </div>

      <div v-if="hasPermissionTree && !activeModule" class="space-y-1">
        <div
          v-if="activeRootInlinePermissionNodes.length > 0"
          class="bg-muted/20 rounded-lg px-3 py-2"
        >
          <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
            <component
              :is="isSingleSelection ? Radio : Checkbox"
              v-for="inlineNode in activeRootInlinePermissionNodes"
              :key="inlineNode.id"
              :checked="isActionSelected(inlineNode.permissionExpr)"
              class="permission-tree-choice"
              :data-test="`permission-${inlineNode.permissionExpr}`"
              @change="
                        handleToggle(
                          inlineNode.permissionExpr,
                          ($event.target as HTMLInputElement).checked,
                )
              "
            >
              <span
                class="inline-block max-w-[12rem] truncate align-bottom"
                :title="inlineNode.title || undefined"
              >
                <IconifyIcon
                  class="text-muted-foreground mr-1 inline size-3.5 align-[-2px]"
                  :icon="getPermissionNodeTypeIcon(inlineNode.nodeType)"
                />
                {{ inlineNode.title }}
              </span>
            </component>
          </div>
        </div>
        <div
          v-for="node in visiblePermissionNodes"
          :key="node.id"
          :class="getPermissionRowClass(node)"
          class="hover:bg-muted/40 relative rounded-lg py-2 pl-3 pr-3 transition"
        >
          <span
            v-for="lineDepth in node.ancestorLineIndexes"
            :key="lineDepth"
            class="border-border/80 pointer-events-none absolute bottom-0 top-0 border-l border-dashed"
            :style="{ left: getMenuTreeGuideLineLeft(lineDepth) }"
          ></span>
          <span
            v-if="node.depth > 0"
            class="border-border/80 pointer-events-none absolute border-l border-dashed"
            :class="node.isLastSibling ? 'top-0 h-[18px]' : 'bottom-0 top-0'"
            :style="{ left: getMenuTreeGuideLineLeft(node.depth - 1) }"
          ></span>
          <span
            v-if="node.depth > 0"
            class="border-border/80 pointer-events-none absolute top-[18px] border-t border-dashed"
            :style="{
              left: getMenuTreeGuideLineLeft(node.depth - 1),
              width: `${MENU_TREE_INDENT_SIZE}px`,
            }"
          ></span>

          <div
            class="relative flex items-start gap-1"
            :style="{ paddingLeft: getMenuTreeNodePaddingLeft(node.depth) }"
          >
            <button
              v-if="hasPermissionChildren(node)"
              :aria-expanded="isPermissionNodeExpanded(node)"
              :aria-label="
                isPermissionNodeExpanded(node) ? '收起权限节点' : '展开权限节点'
              "
              :data-test="`permission-tree-expand-${node.id}`"
              class="text-muted-foreground hover:bg-muted hover:text-foreground mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded transition"
              type="button"
              @click="togglePermissionNodeExpanded(node)"
            >
              <span
                class="text-xs leading-none transition-transform"
                :class="isPermissionNodeExpanded(node) ? 'rotate-90' : ''"
              >
                ▶
              </span>
            </button>
            <span v-else class="mt-0.5 size-5 shrink-0"></span>

            <div class="min-w-0 flex-1">
              <Checkbox
                v-if="!isSingleSelection"
                :checked="isPermissionNodeSelected(node.permissionExpr, node.permissions)"
                class="permission-tree-choice"
                :indeterminate="isPermissionNodeIndeterminate(node.permissionExpr, node.permissions)"
                :data-test="`permission-node-${node.id}`"
                @change="
                  handleTogglePermissions(
                    node.permissions,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              >
                <span
                  class="text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
                  :title="node.title || undefined"
                >
                  <IconifyIcon
                    class="text-muted-foreground inline-flex size-3.5 shrink-0 items-center justify-center"
                    :icon="getPermissionNodeTypeIcon(node.nodeType)"
                  />
                  <Tooltip v-if="hasOwnPermissionMarker(node)" :title="`节点自身权限：${node.permissionExpr}`">
                    <span class="bg-primary size-2 rounded-full" aria-label="节点自身权限"></span>
                  </Tooltip>
                  {{ node.title }}
                </span>
                <span
                  v-if="node.permissions.length > 0"
                  class="text-muted-foreground ml-2 text-xs leading-5"
                >
                  {{ getPermissionCountText(node.permissions) }}
                </span>
              </Checkbox>
              <component
                :is="Radio"
                v-else-if="node.permissionExpr"
                :checked="isActionSelected(node.permissionExpr)"
                class="permission-tree-choice"
                :data-test="`permission-${node.permissionExpr}`"
                @change="handleToggle(node.permissionExpr, true)"
              >
                <span
                  class="text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
                  :title="node.title || undefined"
                >
                  <IconifyIcon
                    class="text-muted-foreground inline-flex size-3.5 shrink-0 items-center justify-center"
                    :icon="getPermissionNodeTypeIcon(node.nodeType)"
                  />
                  {{ node.title }}
                </span>
              </component>
              <span
                v-else
                class="text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
                :title="node.title || undefined"
              >
                <IconifyIcon
                  class="text-muted-foreground inline-flex size-3.5 shrink-0 items-center justify-center"
                  :icon="getPermissionNodeTypeIcon(node.nodeType)"
                />
                {{ node.title }}
              </span>

              <div
                v-if="getPermissionInlineChildren(node).length > 0"
                class="border-border/70 bg-muted/20 ml-7 mt-2 rounded-lg border-l px-3 py-2"
              >
                <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <component
                    :is="isSingleSelection ? Radio : Checkbox"
                    v-for="inlineNode in getPermissionInlineChildren(node)"
                    :key="inlineNode.id"
                    :checked="isActionSelected(inlineNode.permissionExpr)"
                    class="permission-tree-choice"
                    :data-test="`permission-${inlineNode.permissionExpr}`"
                    @change="
                      handleToggle(
                        inlineNode.permissionExpr,
                        ($event.target as HTMLInputElement).checked,
                        node.permissionExpr,
                      )
                    "
                  >
                    <span
                      class="inline-block max-w-[12rem] truncate align-bottom"
                      :title="inlineNode.title || undefined"
                    >
                      <IconifyIcon
                        class="text-muted-foreground mr-1 inline size-3.5 align-[-2px]"
                        :icon="getPermissionNodeTypeIcon(inlineNode.nodeType)"
                      />
                      {{ inlineNode.title }}
                    </span>
                  </component>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="isMenuModuleActive" class="space-y-1">
        <div
          v-for="node in visibleMenuPermissionNodes"
          :key="node.id"
          :class="getMenuPermissionRowClass(node)"
          class="hover:bg-muted/40 relative rounded-lg py-2 pl-3 pr-3 transition"
        >
          <span
            v-for="lineDepth in node.ancestorLineIndexes"
            :key="lineDepth"
            class="border-border/80 pointer-events-none absolute bottom-0 top-0 border-l border-dashed"
            :style="{ left: getMenuTreeGuideLineLeft(lineDepth) }"
          ></span>
          <span
            v-if="node.depth > 0"
            class="border-border/80 pointer-events-none absolute border-l border-dashed"
            :class="node.isLastSibling ? 'top-0 h-[18px]' : 'bottom-0 top-0'"
            :style="{ left: getMenuTreeGuideLineLeft(node.depth - 1) }"
          ></span>
          <span
            v-if="node.depth > 0"
            class="border-border/80 pointer-events-none absolute top-[18px] border-t border-dashed"
            :style="{
              left: getMenuTreeGuideLineLeft(node.depth - 1),
              width: `${MENU_TREE_INDENT_SIZE}px`,
            }"
          ></span>

          <div
            class="relative flex items-start gap-1"
            :style="{ paddingLeft: getMenuTreeNodePaddingLeft(node.depth) }"
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
                :checked="isPermissionNodeSelected(node.selfPermission, node.permissions)"
                :indeterminate="isPermissionNodeIndeterminate(node.selfPermission, node.permissions)"
                :data-test="`permission-${node.permissionExpr}`"
                    @change="
                  handleTogglePermissions(
                    node.permissions,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              >
                <span
                  class="text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
                >
                  <IconifyIcon
                    class="text-muted-foreground size-3.5 shrink-0"
                    :icon="getMenuPermissionNodeIcon(node)"
                  />
                  <Tooltip
                    v-if="node.children.length > 0 && normalizePermissionExpr(node.selfPermission) && isValidPermissionExpr(node.selfPermission)"
                    :title="`节点自身权限：${node.selfPermission}`"
                  >
                    <span class="bg-primary size-2 rounded-full" aria-label="节点自身权限"></span>
                  </Tooltip>
                  {{ node.title }}
                </span>
                <span v-if="node.permissions.length > 0" class="text-muted-foreground ml-2 text-xs">
                  {{ getPermissionCountText(node.permissions) }}
                </span>
              </Checkbox>

              <div
                v-if="getMenuOperationChildren(node).length > 0"
                class="border-border/70 bg-muted/20 ml-7 mt-2 rounded-lg border-l px-3 py-2"
              >
                <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Checkbox
                    v-for="operationNode in getMenuOperationChildren(node)"
                    :key="operationNode.id"
                    :checked="isActionSelected(operationNode.permissionExpr)"
                    :data-test="`permission-${operationNode.permissionExpr}`"
                    @change="
                        handleToggle(
                          operationNode.permissionExpr,
                          ($event.target as HTMLInputElement).checked,
                          node.selfPermission,
                      )
                    "
                  >
                    <span
                      class="inline-block max-w-[12rem] truncate align-bottom"
                      :title="operationNode.title"
                    >
                      <IconifyIcon
                        class="text-muted-foreground mr-1 inline size-3.5 align-[-2px]"
                        :icon="getMenuPermissionNodeIcon(operationNode)"
                      />
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
          hasPermissionTree
            ? activeModule
              ? isMenuModuleActive
                ? visibleMenuPermissionNodes.length === 0
                : filteredTypeList.length === 0
              : visiblePermissionNodes.length === 0
            : isMenuModuleActive
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

<style scoped>
.permission-tree-editor :deep(.permission-tree-choice.ant-checkbox-wrapper),
.permission-tree-editor :deep(.permission-tree-choice.ant-radio-wrapper) {
  align-items: center;
  line-height: 20px;
}

.permission-tree-editor :deep(.permission-tree-choice .ant-checkbox),
.permission-tree-editor :deep(.permission-tree-choice .ant-radio) {
  align-self: center;
  top: 0;
}

.permission-tree-editor :deep(.permission-tree-choice .ant-checkbox + span),
.permission-tree-editor :deep(.permission-tree-choice .ant-radio + span) {
  align-items: center;
  display: inline-flex;
  min-height: 20px;
}
</style>
