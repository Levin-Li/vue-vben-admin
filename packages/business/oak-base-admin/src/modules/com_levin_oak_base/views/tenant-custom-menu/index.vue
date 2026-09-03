<script lang="ts" setup>
import type { DataNode } from 'ant-design-vue/es/tree';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Tree,
} from 'ant-design-vue';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';

import { tenantCustomMenuService } from '../../api/tenant-custom-menu-service';
import { menuService } from '../../api/menu-service';
import CrudPage from '../crud-page.vue';
import { tenantCustomMenuPageCrudConfig } from './config';
import {
  appendLayoutItem,
  appendLayoutItemAtTarget,
  appendLayoutItemsAtTarget,
  canDragLayoutItem,
  canMoveLayoutItem,
  cloneLayoutItems,
  collectExpandedTreeKeys,
  findDuplicateLayoutLabel,
  findLayoutItem,
  filterTreeByLabel,
  flattenMenuSources,
  hasLayoutLabelAtTarget,
  hasLayoutPathAtTarget,
  insertLayoutItemBeside,
  keepLayoutRootExpanded,
  moveLayoutItem,
  removeLayoutItem,
  toLayoutItem,
  toPersistedLayoutItems,
  type TenantCustomMenuItem,
  type MenuDisplaySource,
  updateLayoutItemValue,
} from './layout-tree';

interface LayoutRecord {
  id: string;
  itemList?: Array<Omit<TenantCustomMenuItem, 'key'>>;
  name: string;
  optimisticLock?: number;
  orderCode?: number;
}

interface SourceTreeNode extends MenuDisplaySource {
  children?: SourceTreeNode[];
  key: string;
  orderCode?: number;
  parentId?: string;
  title: string;
}

type LayoutDropMode = 'after' | 'before' | 'child';
type ReloadLayoutList = () => Promise<void> | void;

const MY_MENU_ROOT_KEY = 'root:my-menu';
const MY_MENU_ROOT_LABEL = '菜单列表';

const loading = ref(false);
const saving = ref(false);
const layoutRecords = ref<LayoutRecord[]>([]);
const layoutListReload = ref<ReloadLayoutList>();
const menuSources = ref<MenuDisplaySource[]>([]);
const selectedLayoutId = ref<string>();
const selectedItemKey = ref<string>();
const selectedSourceKeys = ref<string[]>([]);
const checkedLayoutKeys = ref<string[]>([]);
const sourceSearchText = ref('');
const layoutSearchText = ref('');
const layoutExpandedKeys = ref<string[]>([MY_MENU_ROOT_KEY]);
const layoutItems = ref<TenantCustomMenuItem[]>([]);
const isAdjusting = ref(false);
const adjustingLayout = ref(false);
const draggedSource = ref<MenuDisplaySource>();
const draggedLayoutKey = ref<string>();
const dropTargetKey = ref<string>();
const dropTargetMode = ref<LayoutDropMode>();
const hoveredLayoutKey = ref<string>();
const deleteConfirmKey = ref<string>();
const sourceAddActionHoverKey = ref<string>();
const newLayoutOpen = ref(false);
const newGroupOpen = ref(false);
const newLayoutForm = reactive({
  name: '',
  orderCode: 1000,
});
const newGroupForm = reactive({
  label: '',
});
const { hasPermission } = useRbacAccess();

const createPermission = buildApiMethodPermissions(
  tenantCustomMenuService,
  'create',
);
const deletePermission = buildApiMethodPermissions(
  tenantCustomMenuService,
  'delete',
);
const updatePermission = buildApiMethodPermissions(
  tenantCustomMenuService,
  'update',
);
const canCreate = computed(() => hasPermission(createPermission));
const canDelete = computed(() => hasPermission(deletePermission));
const canUpdate = computed(() => hasPermission(updatePermission));
const currentLayout = computed(() =>
  layoutRecords.value.find((item) => item.id === selectedLayoutId.value),
);
const sourcePathSet = computed(
  () =>
    new Set(
      flattenMenuSources(menuSources.value)
        .map((item) => String(item.path || '').trim())
        .filter(Boolean),
    ),
);
const layoutOptions = computed(() =>
  layoutRecords.value.map((item) => ({
    label: `${item.name}${item.orderCode == null ? '' : `（排序 ${item.orderCode}）`}`,
    value: item.id,
  })),
);
const sourceTreeData = computed(() => buildSourceTree(menuSources.value));
const filteredSourceTreeData = computed(() =>
  filterTreeByLabel(
    sourceTreeData.value,
    sourceSearchText.value,
    (item) =>
      [item.name, item.label, item.path, item.title]
        .filter(Boolean)
        .join(' '),
  ),
);
const sourceSearchExpandedKeys = computed(() =>
  collectExpandedTreeKeys(filteredSourceTreeData.value),
);
const sourceByKey = computed(
  () =>
    new Map(
      flattenMenuSources(sourceTreeData.value).map((item) => [item.key, item]),
    ),
);
const selectedMenuSources = computed(() =>
  selectedSourceKeys.value
    .map((key) => sourceByKey.value.get(key))
    .filter((item): item is MenuDisplaySource => Boolean(item)),
);
const hasSelectedSourceMenus = computed(() => selectedMenuSources.value.length > 0);
const checkedLayoutItemKeys = computed(() =>
  checkedLayoutKeys.value.filter((key) => key !== MY_MENU_ROOT_KEY),
);
const hasCheckedLayoutItems = computed(
  () => checkedLayoutItemKeys.value.length > 0,
);
const filteredLayoutItems = computed(() =>
  filterTreeByLabel(
    layoutItems.value,
    layoutSearchText.value,
    (item) => [item.name, item.label, item.path].filter(Boolean).join(' '),
  ),
);
const hasLayoutSearchResults = computed(
  () => filteredLayoutItems.value.length > 0,
);
const visibleLayoutExpandedKeys = computed(() =>
  layoutSearchText.value.trim()
    ? keepLayoutRootExpanded(
        collectExpandedTreeKeys(filteredLayoutItems.value),
        MY_MENU_ROOT_KEY,
      )
    : layoutExpandedKeys.value,
);
const layoutTreeData = computed<DataNode[]>(() => [
  {
    children: toLayoutTreeData(filteredLayoutItems.value, sourcePathSet.value),
    dataRef: {
      enable: true,
      key: MY_MENU_ROOT_KEY,
      label: MY_MENU_ROOT_LABEL,
    },
    disableCheckbox: true,
    isLeaf: false,
    key: MY_MENU_ROOT_KEY,
    title: MY_MENU_ROOT_LABEL,
  },
]);
const layoutTreeDraggable = computed(() =>
  isAdjusting.value
    ? {
        icon: false,
        nodeDraggable: (node: DataNode) =>
          canDragLayoutItem(String(node.key), MY_MENU_ROOT_KEY),
      }
    : false,
);
const hasCurrentLayout = computed(() => Boolean(currentLayout.value));

function listItems<T>(data: any): T[] {
  const value = data?.data ?? data;
  if (Array.isArray(value)) {
    return value;
  }

  return value?.items || value?.records || value?.list || [];
}

function buildSourceTree(items: MenuDisplaySource[]): SourceTreeNode[] {
  const nodes = items.map<SourceTreeNode>((item) => ({
    ...item,
    children: [],
    key: item.id || item.path || item.name || crypto.randomUUID(),
    title: item.label || item.name || item.path || '未命名菜单',
  }));
  const nodeMap = new Map(nodes.map((item) => [item.id, item]));
  const roots: SourceTreeNode[] = [];

  nodes.forEach((node) => {
    const parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
    if (parent && parent !== node) {
      parent.children ||= [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return sortSourceTree(roots);
}

function sortSourceTree(items: SourceTreeNode[]): SourceTreeNode[] {
  return [...items]
    .map((item) => ({ ...item, children: sortSourceTree(item.children || []) }))
    .sort(
      (left, right) =>
        (left.orderCode || 0) - (right.orderCode || 0) ||
        left.title.localeCompare(right.title, 'zh-Hans-CN'),
    );
}

function toLayoutTreeData(
  items: TenantCustomMenuItem[],
  validPaths: Set<string>,
): DataNode[] {
  return items.map((item) => {
    const path = String(item.path || '').trim();
    const isGroup = !path;
    const invalid = Boolean(path) && !validPaths.has(path);
    return {
      children: toLayoutTreeData(item.children || [], validPaths),
      dataRef: item,
      isLeaf: !item.children?.length,
      key: item.key,
      title: item.label,
      selectable: true,
      value: item.key,
      ...(invalid ? { class: 'text-destructive' } : {}),
      ...(isGroup ? { icon: 'folder' } : {}),
    } as DataNode;
  });
}

function normalizeLayoutItems(
  items: Array<Omit<TenantCustomMenuItem, 'key'>> = [],
  parentKey = 'root',
): TenantCustomMenuItem[] {
  const sourceItems =
    parentKey === 'root' &&
    items.length === 1 &&
    !items[0].path &&
    items[0].label === MY_MENU_ROOT_LABEL
      ? items[0].children || []
      : items;

  return sourceItems.map((item, index) => {
    const path = String(item.path || '').trim();
    const key = path
      ? `menu:${parentKey}:${index}:${path}`
      : `group:${parentKey}:${index}:${item.label || 'untitled'}`;
    return {
      children: normalizeLayoutItems(item.children || [], key),
      enable: item.enable !== false,
      key,
      label: item.label || '未命名分组',
      path,
    };
  });
}

async function loadPage() {
  loading.value = true;
  try {
    const [layouts, menus] = await Promise.all([
      tenantCustomMenuService.list({
        pageIndex: 1,
        pageSize: 500,
      }),
      menuService.list({
        loadParent: true,
        pageIndex: 1,
        pageSize: 500,
      }),
    ]);

    layoutRecords.value = listItems<LayoutRecord>(layouts).sort(
      (left, right) =>
        (left.orderCode || 0) - (right.orderCode || 0) ||
        left.id.localeCompare(right.id),
    );
    menuSources.value = listItems<MenuDisplaySource>(menus);

    selectLayout(selectedLayoutId.value || layoutRecords.value[0]?.id);
  } finally {
    loading.value = false;
  }
}

function selectLayout(id?: string) {
  selectedLayoutId.value = id;
  const layout = layoutRecords.value.find((item) => item.id === id);
  layoutItems.value = normalizeLayoutItems(layout?.itemList || []);
  selectedItemKey.value = undefined;
  checkedLayoutKeys.value = [];
  isAdjusting.value = false;
}

function addMenu(source: MenuDisplaySource) {
  addMenusToSelectedTarget([source]);
}

function handleSourceCheck(checkedKeys: unknown) {
  const keys = Array.isArray(checkedKeys)
    ? checkedKeys
    : (checkedKeys as { checked?: unknown[] })?.checked || [];
  selectedSourceKeys.value = keys.map(String);
}

function syncSourceAncestorChecks(
  items: SourceTreeNode[],
  checkedKeys: Set<string>,
) {
  return items.every((item) => {
    const children = item.children || [];
    if (!children.length) {
      return checkedKeys.has(item.key);
    }

    const allChildrenChecked = syncSourceAncestorChecks(children, checkedKeys);
    if (allChildrenChecked) {
      checkedKeys.add(item.key);
    } else {
      checkedKeys.delete(item.key);
    }
    return checkedKeys.has(item.key);
  });
}

function toggleSourceMenuCheck(source: SourceTreeNode) {
  const checkedKeys = new Set(selectedSourceKeys.value);
  const subtreeKeys = flattenMenuSources([source]).map((item) => item.key!);
  const shouldCheck = !checkedKeys.has(source.key);

  for (const key of subtreeKeys) {
    if (shouldCheck) {
      checkedKeys.add(key);
    } else {
      checkedKeys.delete(key);
    }
  }
  syncSourceAncestorChecks(sourceTreeData.value, checkedKeys);
  selectedSourceKeys.value = flattenMenuSources(sourceTreeData.value)
    .map((item) => item.key)
    .filter((key): key is string => Boolean(key && checkedKeys.has(key)));
}

function clearSourceMenuChecks() {
  selectedSourceKeys.value = [];
}

function toggleAllSourceMenuChecks() {
  if (hasSelectedSourceMenus.value) {
    clearSourceMenuChecks();
    return;
  }

  selectedSourceKeys.value = flattenMenuSources(sourceTreeData.value)
    .map((item) => item.key)
    .filter((key): key is string => Boolean(key));
}

function handleLayoutCheck(
  checkedKeys: unknown,
  info?: { node?: { eventKey?: number | string; key?: number | string } },
) {
  const key = getTreeNodeKey(info?.node);
  if (key) {
    selectedItemKey.value = key;
  }
  const keys = Array.isArray(checkedKeys)
    ? checkedKeys
    : (checkedKeys as { checked?: unknown[] })?.checked || [];
  checkedLayoutKeys.value = keys.map(String);
}

function collectLayoutItemKeys(item: TenantCustomMenuItem): string[] {
  return [
    item.key,
    ...(item.children || []).flatMap((child) => collectLayoutItemKeys(child)),
  ];
}

function syncLayoutAncestorChecks(
  items: TenantCustomMenuItem[],
  checkedKeys: Set<string>,
) {
  return items.every((item) => {
    const children = item.children || [];
    if (!children.length) {
      return checkedKeys.has(item.key);
    }

    const allChildrenChecked = syncLayoutAncestorChecks(children, checkedKeys);
    if (allChildrenChecked) {
      checkedKeys.add(item.key);
    } else {
      checkedKeys.delete(item.key);
    }
    return checkedKeys.has(item.key);
  });
}

function toggleLayoutItemCheck(dataRef: DataNode) {
  const item = getLayoutTreeItem(dataRef);
  selectedItemKey.value = item.key;
  if (item.key === MY_MENU_ROOT_KEY) {
    return;
  }

  const checkedKeys = new Set(checkedLayoutKeys.value);
  const shouldCheck = !checkedKeys.has(item.key);
  for (const key of collectLayoutItemKeys(item)) {
    if (shouldCheck) {
      checkedKeys.add(key);
    } else {
      checkedKeys.delete(key);
    }
  }
  syncLayoutAncestorChecks(layoutItems.value, checkedKeys);
  checkedLayoutKeys.value = collectLayoutItemKeys({
    children: layoutItems.value,
    key: MY_MENU_ROOT_KEY,
    label: MY_MENU_ROOT_LABEL,
  }).filter((key) => key !== MY_MENU_ROOT_KEY && checkedKeys.has(key));
}

function addSelectedMenus() {
  addMenusToSelectedTarget(selectedMenuSources.value);
}

function addMenusToSelectedTarget(sources: MenuDisplaySource[]) {
  if (!isAdjusting.value) {
    return;
  }

  const targetKey = selectedItemKey.value;
  if (!targetKey) {
    message.warning('请先在我的菜单中选择目标节点');
    return;
  }

  const items = sources
    .map((source) => createLayoutItemForTarget(source, targetKey))
    .filter((item) => Boolean(item.path));
  if (!items.length) {
    message.warning('所选菜单没有可用路径，不能加入展示布局');
    return;
  }

  const { added, skipped } = appendLayoutItemsAtTarget(
    layoutItems.value,
    MY_MENU_ROOT_KEY,
    targetKey,
    items,
  );
  if (!added && !skipped) {
    message.warning('未找到选中的菜单目标');
    return;
  }
  if (added) {
    layoutItems.value = cloneLayoutItems(layoutItems.value);
    expandLayoutParent(targetKey);
    clearSourceMenuChecks();
  }
  if (skipped) {
    message.warning(
      added
        ? `已添加 ${added} 个菜单，${skipped} 个菜单名称或路径重复`
        : '菜单名称或路径重复',
    );
  } else {
    message.success(`已添加 ${added} 个菜单`);
  }
}

function beginAdjusting() {
  if (!currentLayout.value) {
    message.warning('请先新增或选择一个菜单展示布局');
    return;
  }

  isAdjusting.value = true;
}

function cancelAdjusting() {
  selectLayout(selectedLayoutId.value);
}

function clearLayoutDropTarget() {
  draggedSource.value = undefined;
  draggedLayoutKey.value = undefined;
  dropTargetKey.value = undefined;
  dropTargetMode.value = undefined;
}

function handleSourceDragStart(event: DragEvent, source: MenuDisplaySource) {
  if (!isAdjusting.value) {
    return;
  }

  draggedLayoutKey.value = undefined;
  dropTargetKey.value = undefined;
  dropTargetMode.value = undefined;
  draggedSource.value = source;
  event.dataTransfer?.setData('text/plain', source.path || source.id || 'menu');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copyMove';
  }
}

function handleLayoutDragEnter(info: any) {
  if (!draggedSource.value) {
    beginLayoutItemDrag(getTreeNodeKey(info.dragNode));
  }
}

function getTreeNodeKey(node: any) {
  const key = node?.key ?? node?.eventKey;
  return key == null ? undefined : String(key);
}

function getLayoutDropModeFromPointer(
  event: DragEvent,
): LayoutDropMode {
  const pointerTarget = event.target as HTMLElement | null;
  if (pointerTarget?.closest('.layout-menu-label-drop-zone')) {
    return 'child';
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const relativeY = event.clientY - rect.top;
  return relativeY < rect.height / 2 ? 'before' : 'after';
}

function setLayoutDropTarget(key?: string, mode?: LayoutDropMode) {
  if (!key || (!draggedSource.value && !draggedLayoutKey.value)) {
    return;
  }

  if (key === draggedLayoutKey.value) {
    dropTargetKey.value = undefined;
    dropTargetMode.value = undefined;
    return;
  }

  dropTargetKey.value = key;
  dropTargetMode.value = mode || (draggedSource.value ? 'child' : undefined);
}

function isActiveLayoutDropTarget(key: string, mode?: LayoutDropMode) {
  return (
    dropTargetKey.value === key &&
    key !== draggedLayoutKey.value &&
    (!mode || dropTargetMode.value === mode) &&
    Boolean(draggedSource.value || draggedLayoutKey.value)
  );
}

function shouldShowAddChildMenuAction(key: string) {
  return !draggedSource.value && !draggedLayoutKey.value;
}

function beginLayoutItemDrag(key?: string) {
  if (key && canDragLayoutItem(key, MY_MENU_ROOT_KEY)) {
    const isSameDraggedLayoutItem =
      !draggedSource.value && draggedLayoutKey.value === key;
    draggedSource.value = undefined;
    if (!isSameDraggedLayoutItem) {
      dropTargetKey.value = undefined;
      dropTargetMode.value = undefined;
    }
    draggedLayoutKey.value = key;
  }
}

function handleLayoutDragStart(info: any) {
  beginLayoutItemDrag(getTreeNodeKey(info.node));
  const dragEvent = info.event as DragEvent | undefined;
  if (dragEvent?.dataTransfer) {
    dragEvent.dataTransfer.effectAllowed = 'copyMove';
  }
}

function setLayoutDropEffect(event: DragEvent, mode: LayoutDropMode) {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = mode === 'child' ? 'copy' : 'move';
  }
}

function updateLayoutDropTargetFromPointer(event: DragEvent, key: string) {
  event.preventDefault();
  const dropMode = getLayoutDropModeFromPointer(event);
  setLayoutDropTarget(key, dropMode);
  setLayoutDropEffect(event, dropMode);
}

function createLayoutItemForTarget(
  source: MenuDisplaySource,
  targetKey: string,
) {
  return {
    ...toLayoutItem(source),
    key: `menu:${targetKey}:${crypto.randomUUID()}`,
  };
}

function findLayoutParentKey(
  items: TenantCustomMenuItem[],
  key: string,
  parentKey = MY_MENU_ROOT_KEY,
): string | undefined {
  for (const item of items) {
    if (item.key === key) {
      return parentKey;
    }

    const foundParentKey = findLayoutParentKey(item.children || [], key, item.key);
    if (foundParentKey) {
      return foundParentKey;
    }
  }
}

function appendSourceAtTarget(
  source: MenuDisplaySource,
  targetKey: string,
  dropMode: LayoutDropMode = 'child',
) {
  const sourceItem = createLayoutItemForTarget(source, targetKey);
  if (!sourceItem.path) {
    message.warning(
      '该菜单没有路由路径',
    );
    return false;
  }
  const destinationKey =
    dropMode === 'child'
      ? targetKey
      : findLayoutParentKey(layoutItems.value, targetKey) || MY_MENU_ROOT_KEY;
  if (
    hasLayoutPathAtTarget(
      layoutItems.value,
      MY_MENU_ROOT_KEY,
      destinationKey,
      sourceItem.path,
    )
  ) {
    message.warning('菜单已经添加');
    return false;
  }
  if (
    hasLayoutLabelAtTarget(
      layoutItems.value,
      MY_MENU_ROOT_KEY,
      destinationKey,
      sourceItem.label,
    )
  ) {
    message.warning('同一节点下不能存在同名菜单');
    return false;
  }

  const inserted =
    dropMode === 'child'
      ? appendLayoutItemAtTarget(
          layoutItems.value,
          MY_MENU_ROOT_KEY,
          targetKey,
          sourceItem,
        )
      : insertLayoutItemBeside(
          layoutItems.value,
          targetKey,
          sourceItem,
          dropMode === 'after',
        );
  if (inserted) {
    layoutItems.value = cloneLayoutItems(layoutItems.value);
    if (dropMode === 'child') {
      expandLayoutParent(targetKey);
    }
  }
  return inserted;
}

function handleLayoutSourceDrop(event: DragEvent, targetKey: string) {
  event.preventDefault();
  const source = draggedSource.value;
  const dropMode = dropTargetMode.value || 'child';
  if (!source) {
    return;
  }

  appendSourceAtTarget(source, targetKey, dropMode);
  clearLayoutDropTarget();
}

function handleLayoutExpand(keys: Array<number | string>) {
  layoutExpandedKeys.value = keepLayoutRootExpanded(keys, MY_MENU_ROOT_KEY);
}

function expandLayoutParent(key: string | undefined) {
  if (!key) {
    return;
  }

  layoutExpandedKeys.value = keepLayoutRootExpanded(
    [...layoutExpandedKeys.value, key],
    MY_MENU_ROOT_KEY,
  );
}

function openNewGroup() {
  if (!isAdjusting.value) {
    return;
  }

  newGroupForm.label = '';
  newGroupOpen.value = true;
}

function addGroup() {
  const label = newGroupForm.label.trim();
  if (!label) {
    message.warning('请输入分组名称');
    return;
  }

  const item: TenantCustomMenuItem = {
    key: `group:${crypto.randomUUID()}`,
    label,
  };
  if (!appendLayoutItem(layoutItems.value, selectedItemKey.value, item)) {
    message.warning('同一节点下不能存在同名菜单');
    return;
  }
  layoutItems.value = cloneLayoutItems(layoutItems.value);
  expandLayoutParent(selectedItemKey.value);
  newGroupOpen.value = false;
}

function addChildLayoutItem(parent: TenantCustomMenuItem) {
  const item: TenantCustomMenuItem = {
    key: `group:${crypto.randomUUID()}`,
    label: '新菜单',
  };
  if (
    !appendLayoutItemAtTarget(
      layoutItems.value,
      MY_MENU_ROOT_KEY,
      parent.key,
      item,
    )
  ) {
    message.warning('同一节点下不能存在同名菜单');
    return;
  }
  layoutItems.value = cloneLayoutItems(layoutItems.value);
  expandLayoutParent(parent.key);
}

function removeLayoutItemByKey(key: string) {
  if (key === MY_MENU_ROOT_KEY) {
    return;
  }
  removeLayoutItem(layoutItems.value, key);
  layoutItems.value = cloneLayoutItems(layoutItems.value);
  deleteConfirmKey.value = undefined;
  selectedItemKey.value = undefined;
}

function handleDeleteConfirmOpenChange(key: string, open: boolean) {
  deleteConfirmKey.value = open ? key : undefined;
}

function clearLayoutItemChecks() {
  checkedLayoutKeys.value = [];
}

function toggleAllLayoutItemChecks() {
  if (hasCheckedLayoutItems.value) {
    clearLayoutItemChecks();
    return;
  }

  checkedLayoutKeys.value = collectLayoutItemKeys({
    children: layoutItems.value,
    key: MY_MENU_ROOT_KEY,
    label: MY_MENU_ROOT_LABEL,
  }).filter((key) => key !== MY_MENU_ROOT_KEY);
}

function removeCheckedLayoutItems() {
  const keys = checkedLayoutItemKeys.value;
  if (!keys.length) {
    return;
  }

  Modal.confirm({
    cancelText: '取消',
    content: `确认删除选中的 ${keys.length} 个菜单及其子菜单？`,
    okButtonProps: { danger: true },
    okText: '删除',
    onOk: () => {
      const next = cloneLayoutItems(layoutItems.value);
      let removed = 0;
      for (const key of keys) {
        if (removeLayoutItem(next, key)) {
          removed += 1;
        }
      }
      if (!removed) {
        return;
      }

      layoutItems.value = next;
      checkedLayoutKeys.value = [];
      selectedItemKey.value = MY_MENU_ROOT_KEY;
      message.success('已删除选中的菜单');
    },
    title: '确认删除选中的菜单？',
  });
}

function getLayoutTreeItem(dataRef: DataNode) {
  return (dataRef.dataRef as TenantCustomMenuItem | undefined) ||
    (dataRef as TenantCustomMenuItem);
}

function updateLayoutItem(
  dataRef: DataNode,
  field: 'enable' | 'label',
  value: boolean | string,
) {
  const item = getLayoutTreeItem(dataRef);
  if (
    field === 'label' &&
    hasLayoutLabelAtTarget(
      layoutItems.value,
      MY_MENU_ROOT_KEY,
      findLayoutParentKey(layoutItems.value, item.key) || MY_MENU_ROOT_KEY,
      String(value),
      item.key,
    )
  ) {
    message.warning('同一节点下不能存在同名菜单');
    return;
  }
  if (
    !updateLayoutItemValue(
      layoutItems.value,
      item.key,
      field,
      value,
    )
  ) {
    return;
  }
  layoutItems.value = cloneLayoutItems(layoutItems.value);
}

function moveLayoutItemByKey(
  key: string,
  direction: 'down' | 'up',
) {
  if (moveLayoutItem(layoutItems.value, key, direction)) {
    layoutItems.value = cloneLayoutItems(layoutItems.value);
  }
}

function handleLayoutDrop(info: any) {
  if (!isAdjusting.value) {
    return;
  }

  const source = draggedSource.value;
  const dropMode = dropTargetMode.value;
  clearLayoutDropTarget();
  const dragKey = getTreeNodeKey(info.dragNode) || '';
  const targetKey = getTreeNodeKey(info.node) || '';
  if (!targetKey) {
    return;
  }

  if (source) {
    appendSourceAtTarget(source, targetKey, dropMode || 'child');
    return;
  }

  if (!dragKey || dragKey === targetKey) {
    return;
  }

  const movedAsChild = dropMode ? dropMode === 'child' : !info.dropToGap;
  const moveAfter = dropMode ? dropMode === 'after' : Number(info.dropPosition) > 0;
  const destinationKey = movedAsChild
    ? targetKey
    : findLayoutParentKey(layoutItems.value, targetKey) || MY_MENU_ROOT_KEY;
  const movedItem = findLayoutItem(layoutItems.value, dragKey);
  if (
    movedItem &&
    hasLayoutLabelAtTarget(
      layoutItems.value,
      MY_MENU_ROOT_KEY,
      destinationKey,
      movedItem.label,
      movedItem.key,
    )
  ) {
    message.warning('同一节点下不能存在同名菜单');
    return;
  }

  const next = cloneLayoutItems(layoutItems.value);
  const moved = removeLayoutItem(next, dragKey);
  if (!moved) {
    return;
  }

  const success =
    targetKey === MY_MENU_ROOT_KEY
      ? (
          (dropMode === 'before' ||
            (info.dropToGap && Number(info.dropPosition) < 0)
            ? next.unshift(moved)
            : next.push(moved)),
          true
        )
      : movedAsChild
    ? appendLayoutItem(next, targetKey, moved)
    : insertLayoutItemBeside(
        next,
        targetKey,
        moved,
        moveAfter,
      );

  if (success) {
    layoutItems.value = next;
    if (movedAsChild) {
      expandLayoutParent(targetKey);
    }
  }
}

function openNewLayout() {
  newLayoutForm.name = '';
  newLayoutForm.orderCode = 1000;
  newLayoutOpen.value = true;
}

async function createLayout() {
  const name = newLayoutForm.name.trim();
  if (!name) {
    message.warning('请输入布局名称');
    return;
  }

  saving.value = true;
  try {
    await tenantCustomMenuService.create({
      enable: true,
      itemList: [],
      name,
      orderCode: newLayoutForm.orderCode,
    });
    newLayoutOpen.value = false;
    await loadPage();
    message.success('已新增菜单展示布局');
  } finally {
    saving.value = false;
  }
}

async function saveLayout() {
  const layout = currentLayout.value;
  if (!layout) {
    message.warning('请先新增或选择一个布局');
    return;
  }

  const duplicateLabel = findDuplicateLayoutLabel(layoutItems.value);
  if (duplicateLabel) {
    message.warning(`同一节点下不能存在同名菜单：${duplicateLabel}`);
    return;
  }

  saving.value = true;
  try {
    await tenantCustomMenuService.update({
      autoForceUpdateField: false,
      forceUpdateFields: ['itemList'],
      id: layout.id,
      itemList: toPersistedLayoutItems(layoutItems.value),
      optimisticLock: layout.optimisticLock,
    });
    layout.itemList = toPersistedLayoutItems(layoutItems.value);
    layout.optimisticLock = (layout.optimisticLock ?? 0) + 1;
    try {
      await layoutListReload.value?.();
    } catch {
      message.warning('菜单已保存，但列表刷新失败');
    }
    message.success('菜单展示布局已保存');
  } finally {
    saving.value = false;
  }
}

async function deleteLayout() {
  const layout = currentLayout.value;
  if (!layout) {
    return;
  }

  saving.value = true;
  try {
    await tenantCustomMenuService.delete({ id: layout.id });
    selectedLayoutId.value = undefined;
    await loadPage();
    message.success('菜单展示布局已删除');
  } finally {
    saving.value = false;
  }
}

async function openLayoutAdjuster(
  record: LayoutRecord,
  reload?: ReloadLayoutList,
) {
  adjustingLayout.value = true;
  selectedLayoutId.value = record.id;
  selectedItemKey.value = MY_MENU_ROOT_KEY;
  checkedLayoutKeys.value = [];
  layoutListReload.value = reload;
  sourceSearchText.value = '';
  layoutSearchText.value = '';
  layoutRecords.value = [record];
  layoutItems.value = normalizeLayoutItems(record.itemList || []);
  isAdjusting.value = true;
  loading.value = true;
  try {
    menuSources.value = listItems<MenuDisplaySource>(
      await menuService.list({ loadParent: true, pageIndex: 1, pageSize: 500 }),
    );
  } finally {
    loading.value = false;
  }
}

function closeLayoutAdjuster() {
  adjustingLayout.value = false;
  isAdjusting.value = false;
  selectedItemKey.value = undefined;
  checkedLayoutKeys.value = [];
  layoutListReload.value = undefined;
  sourceSearchText.value = '';
  layoutSearchText.value = '';
}
</script>

<template>
  <CrudPage :config="tenantCustomMenuPageCrudConfig">
    <template #row-actions="{ record, reload }">
      <Button
        v-if="canUpdate"
        size="small"
        type="link"
        @click="openLayoutAdjuster(record, reload)"
      >
        调整菜单
      </Button>
    </template>
  </CrudPage>

  <Modal
    v-model:open="adjustingLayout"
    :body-style="{ maxHeight: 'calc(80vh - 128px)', overflowY: 'hidden' }"
    :footer="null"
    :mask-closable="false"
    title="调整菜单"
    width="70vw"
    @cancel="closeLayoutAdjuster"
  >
    <Page auto-content-height content-class="flex min-h-0 flex-col gap-4">
    <Card :bordered="false" size="small">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-muted-foreground">{{ currentLayout?.name }}</span>
        <div class="flex-1" />
        <Button
          v-if="canUpdate"
          :disabled="!hasCurrentLayout"
          :loading="saving"
          type="primary"
          @click="saveLayout"
        >
          保存
        </Button>
      </div>
    </Card>

    <Spin :spinning="loading" class="min-h-0 flex-1">
      <div
        class="grid h-[calc(80vh-230px)] min-h-[320px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
      >
        <Card
          :body-style="{ height: 'calc(80vh - 300px)', overflowY: 'auto' }"
          :bordered="false"
          class="min-h-0"
        >
          <template #title>
            <div class="flex w-full items-center gap-2">
              <span>系统菜单</span>
              <Input
                v-model:value="sourceSearchText"
                allow-clear
                class="w-48"
                placeholder="搜索菜单"
              />
              <div class="flex-1" />
              <Button
                size="small"
                @click="toggleAllSourceMenuChecks"
              >
                {{ hasSelectedSourceMenus ? '清空选中' : '全部选中' }}
              </Button>
            </div>
          </template>
          <Tree
            v-if="filteredSourceTreeData.length"
            checkable
            class="min-h-0"
            default-expand-all
            :checked-keys="selectedSourceKeys"
            :expanded-keys="
              sourceSearchText.trim() ? sourceSearchExpandedKeys : undefined
            "
            :tree-data="filteredSourceTreeData"
            @check="handleSourceCheck"
          >
            <template #title="{ dataRef }">
              <Tooltip
                :title="
                  sourceAddActionHoverKey === dataRef.key
                    ? undefined
                    : '可拖到我的菜单'
                "
              >
                <div
                  class="group relative flex h-9 w-full min-w-0 items-center gap-2 py-1 pr-9"
                  :class="
                    isAdjusting ? 'cursor-grab active:cursor-grabbing' : undefined
                  "
                  :draggable="isAdjusting"
                  @click="toggleSourceMenuCheck(dataRef)"
                  @dragend="clearLayoutDropTarget"
                  @dragstart="(event) => handleSourceDragStart(event, dataRef)"
                >
                  <IconifyIcon
                    v-if="isAdjusting"
                    class="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    icon="lucide:grip-vertical"
                  />
                  <IconifyIcon
                    class="text-muted-foreground size-4 shrink-0"
                    :icon="dataRef.icon || 'lucide:panel-right-open'"
                  />
                  <span class="block min-w-0 flex-1 truncate">
                    {{ dataRef.title }}
                  </span>
                  <Tooltip title="点击添加到右侧选中的节点">
                    <Button
                      class="absolute right-1 top-1/2 hidden !size-7 shrink-0 -translate-y-1/2 items-center justify-center !p-0 group-hover:inline-flex"
                      size="small"
                      type="text"
                      @mouseenter="sourceAddActionHoverKey = dataRef.key"
                      @mouseleave="sourceAddActionHoverKey = undefined"
                      @mousedown.stop
                      @click.stop="addMenu(dataRef)"
                    >
                      <IconifyIcon class="size-4" icon="lucide:arrow-right" />
                    </Button>
                  </Tooltip>
                </div>
              </Tooltip>
            </template>
          </Tree>
          <Empty
            v-else
            :description="
              sourceSearchText.trim() ? '未找到匹配菜单' : '暂无可用菜单'
            "
          />
        </Card>

        <div class="flex items-center justify-center">
          <Tooltip title="添加选中的系统菜单到右侧选中节点">
            <Button
              aria-label="添加选中的系统菜单"
              :disabled="!hasSelectedSourceMenus"
              shape="circle"
              type="primary"
              @click="addSelectedMenus"
            >
              <IconifyIcon class="size-4" icon="lucide:arrow-right" />
            </Button>
          </Tooltip>
        </div>

        <Card
          :body-style="{ height: 'calc(80vh - 300px)', overflowY: 'auto' }"
          :bordered="false"
          class="min-h-0"
        >
          <template #title>
            <div class="flex w-full items-center gap-2">
              <span>我的菜单</span>
              <Input
                v-model:value="layoutSearchText"
                allow-clear
                class="w-48"
                placeholder="搜索菜单"
              />
              <div class="flex-1" />
              <Button
                size="small"
                @click="toggleAllLayoutItemChecks"
              >
                {{ hasCheckedLayoutItems ? '清空选中' : '全部选中' }}
              </Button>
              <Button
                danger
                :disabled="!hasCheckedLayoutItems"
                size="small"
                @click="removeCheckedLayoutItems"
              >
                删除选中
              </Button>
            </div>
          </template>
          <Empty
            v-if="!hasCurrentLayout"
            description="请先新增一个菜单展示布局"
          />
          <Empty
            v-else-if="layoutSearchText.trim() && !hasLayoutSearchResults"
            description="未找到匹配菜单"
          />
          <Tree
            v-else
            checkable
            class="-ml-2 -mt-2 min-h-0"
            :checked-keys="checkedLayoutKeys"
            :draggable="layoutTreeDraggable"
            :expanded-keys="visibleLayoutExpandedKeys"
            :selected-keys="selectedItemKey ? [selectedItemKey] : []"
            :tree-data="layoutTreeData"
            @dragend="clearLayoutDropTarget"
            @dragenter="handleLayoutDragEnter"
            @dragstart="handleLayoutDragStart"
            @drop="handleLayoutDrop"
            @expand="handleLayoutExpand"
            @check="handleLayoutCheck"
            @select="(keys: string[]) => (selectedItemKey = keys[0])"
          >
            <template #title="{ dataRef }">
              <div
                class="relative flex min-w-0 flex-wrap items-center gap-2 rounded border border-transparent px-1 py-1"
                @click.stop="toggleLayoutItemCheck(dataRef)"
                @dragenter="
                  (event) => updateLayoutDropTargetFromPointer(event, dataRef.key)
                "
                @dragover="
                  (event) => updateLayoutDropTargetFromPointer(event, dataRef.key)
                "
                @drop="(event) => handleLayoutSourceDrop(event, dataRef.key)"
                @mouseenter="hoveredLayoutKey = dataRef.key"
                @mouseleave="hoveredLayoutKey = undefined"
              >
                <span
                  v-if="isActiveLayoutDropTarget(dataRef.key, 'before')"
                  class="pointer-events-none absolute -top-1 left-0 right-0 z-10 h-0.5 bg-primary"
                />
                <span
                  v-if="isActiveLayoutDropTarget(dataRef.key, 'after')"
                  class="pointer-events-none absolute -bottom-1 left-0 right-0 z-10 h-0.5 bg-primary"
                />
                <span
                  v-if="dataRef.key === MY_MENU_ROOT_KEY"
                  class="min-w-28 flex-1"
                >
                  菜单列表
                </span>
                <template v-else>
                  <IconifyIcon
                    v-if="isAdjusting"
                    class="text-muted-foreground size-3.5 shrink-0 cursor-grab active:cursor-grabbing"
                    icon="lucide:grip-vertical"
                  />
                  <div
                    class="layout-menu-label-drop-zone relative min-w-28 flex-1"
                  >
                    <Tooltip :title="getLayoutTreeItem(dataRef).path || undefined">
                      <Input
                        :class="
                          isActiveLayoutDropTarget(dataRef.key, 'child')
                            ? '!border-primary'
                            : undefined
                        "
                        class="layout-menu-label-input w-full"
                        :value="getLayoutTreeItem(dataRef).label"
                        @click.stop="selectedItemKey = dataRef.key"
                        @mousedown.stop
                        @update:value="
                          (value) => updateLayoutItem(dataRef, 'label', value)
                        "
                      />
                    </Tooltip>
                  </div>
                  <Switch
                    :checked="getLayoutTreeItem(dataRef).enable !== false"
                    checked-children="启用"
                    @click.stop
                    @mousedown.stop
                    @update:checked="
                      (value) => updateLayoutItem(dataRef, 'enable', value)
                    "
                  />
                </template>
                <template
                  v-if="
                    hoveredLayoutKey === dataRef.key ||
                    deleteConfirmKey === dataRef.key ||
                    isActiveLayoutDropTarget(dataRef.key, 'child')
                  "
                >
                  <template v-if="dataRef.key !== MY_MENU_ROOT_KEY">
                    <Tooltip title="上移">
                      <Button
                        :disabled="
                          !canMoveLayoutItem(
                            layoutItems,
                            dataRef.key,
                            'up',
                          )
                        "
                        size="small"
                        @click.stop="moveLayoutItemByKey(dataRef.key, 'up')"
                      >
                        <IconifyIcon class="size-3.5" icon="lucide:arrow-up" />
                      </Button>
                    </Tooltip>
                    <Tooltip title="下移">
                      <Button
                        :disabled="
                          !canMoveLayoutItem(
                            layoutItems,
                            dataRef.key,
                            'down',
                          )
                        "
                        size="small"
                        @click.stop="moveLayoutItemByKey(dataRef.key, 'down')"
                      >
                        <IconifyIcon
                          class="size-3.5"
                          icon="lucide:arrow-down"
                        />
                      </Button>
                    </Tooltip>
                    <Popconfirm
                      title="确认删除当前菜单及其子菜单？"
                      @confirm="removeLayoutItemByKey(dataRef.key)"
                      @open-change="
                        (open) =>
                          handleDeleteConfirmOpenChange(dataRef.key, open)
                      "
                    >
                      <Tooltip title="删除菜单">
                        <Button danger size="small" @click.stop>
                          －
                        </Button>
                      </Tooltip>
                    </Popconfirm>
                  </template>
                  <template v-if="shouldShowAddChildMenuAction(dataRef.key)">
                    <Tooltip title="新增子菜单">
                      <Button
                        :class="
                          isActiveLayoutDropTarget(dataRef.key, 'child')
                            ? '!border-primary text-primary'
                            : undefined
                        "
                        size="small"
                        @click.stop="addChildLayoutItem(dataRef)"
                      >
                        ＋
                      </Button>
                    </Tooltip>
                  </template>
                </template>
              </div>
            </template>
          </Tree>
        </Card>

      </div>
    </Spin>

    <Modal
      v-model:open="newLayoutOpen"
      :mask-closable="false"
      :confirm-loading="saving"
      title="新增菜单展示布局"
      @ok="createLayout"
    >
      <Form layout="vertical">
        <Form.Item label="布局名称" required>
          <Input
            v-model:value="newLayoutForm.name"
            placeholder="例如：默认后台布局"
          />
        </Form.Item>
        <Form.Item label="排序代码">
          <InputNumber v-model:value="newLayoutForm.orderCode" class="w-full" />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="newGroupOpen"
      :mask-closable="false"
      title="新增展示分组"
      @ok="addGroup"
    >
      <Form layout="vertical">
        <Form.Item label="分组名称" required>
          <Input
            v-model:value="newGroupForm.label"
            placeholder="例如：视频号"
          />
        </Form.Item>
      </Form>
    </Modal>
    </Page>
  </Modal>
</template>
