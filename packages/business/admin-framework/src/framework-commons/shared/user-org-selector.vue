<script setup lang="ts">
import type { PropType } from 'vue';
import type {
  UserOrgSelectorLoadOrgTree,
  UserOrgSelectorLoadUsers,
  UserOrgSelectorKind,
  UserOrgSelectorModelValue,
  UserOrgSelectorOrgLoadMode,
  UserOrgSelectorRecord,
  UserOrgSelectorResolveRecords,
  UserOrgSelectorValueMode,
  UserOrgTreeSelectNode,
} from './user-org-selector-types';

import { computed, ref, watch } from 'vue';

import { TreeSelect, message } from 'ant-design-vue';
import { IconifyIcon } from '@vben/runtime/icons';

import { fetchCrudList } from '../api';
import { rbacService } from '../app/api/rbac-service';
import {
  buildSelectedRecordGroupNode,
  buildUserOrgSelectorOrgTree,
  decodeUserOrgSelectorKey,
  encodeUserOrgSelectorKey,
  flattenUserOrgTreeNodes,
  getUserOrgSelectorNodeIcon,
  limitUserOrgSelectorRecords,
  normalizeSelectorTypes,
  normalizeUserSelectorRecord,
  toUserOrgTreeSelectNode,
} from './user-org-selector-utils';

defineOptions({
  name: 'UserOrgSelector',
});

const props = defineProps({
  allowClear: {
    default: true,
    type: Boolean,
  },
  selectableTypes: {
    default: () => ['org', 'user'],
    type: Array as PropType<UserOrgSelectorKind[]>,
  },
  disabled: {
    default: false,
    type: Boolean,
  },
  maxLoadDeep: {
    default: 0,
    type: Number,
  },
  maxSelectCount: {
    default: 0,
    type: Number,
  },
  loadUsers: {
    type: Function as PropType<UserOrgSelectorLoadUsers>,
  },
  userLoadApi: {
    type: Function as PropType<UserOrgSelectorLoadUsers>,
  },
  loadOrgTree: {
    type: Function as PropType<UserOrgSelectorLoadOrgTree>,
  },
  orgLoadApi: {
    type: Function as PropType<UserOrgSelectorLoadOrgTree>,
  },
  orgLoadMode: {
    default: 'all',
    type: String as PropType<UserOrgSelectorOrgLoadMode>,
  },
  modelValue: {
    type: [Array, Object, String] as PropType<UserOrgSelectorModelValue>,
  },
  multiple: {
    default: false,
    type: Boolean,
  },
  onlyLeafNode: {
    default: false,
    type: Boolean,
  },
  onlyNotLeafNode: {
    default: false,
    type: Boolean,
  },
  onlyShowTypeMatchNode: {
    default: false,
    type: Boolean,
  },
  rootOrgIdList: {
    default: () => [],
    type: Array as PropType<string[]>,
  },
  orgTypes: {
    default: () => [],
    type: Array as PropType<string[]>,
  },
  placeholder: {
    default: '请选择用户或组织',
    type: String,
  },
  resolveRecords: {
    type: Function as PropType<UserOrgSelectorResolveRecords>,
  },
  selectedRecords: {
    default: () => [],
    type: Array as PropType<UserOrgSelectorRecord[]>,
  },
  showTenantNodes: { default: false, type: Boolean },
  tenantOptions: {
    default: () => [],
    type: Array as PropType<Array<{ label: string; value: string }>>,
  },
  showSearch: {
    default: true,
    type: Boolean,
  },
  showNodeIcons: {
    default: true,
    type: Boolean,
  },
  userApiModuleBase: {
    default: '',
    type: String,
  },
  userListPath: {
    default: '/User/list',
    type: String,
  },
  userPageSize: {
    default: 500,
    type: Number,
  },
  userTypes: {
    default: () => [],
    type: Array as PropType<string[]>,
  },
  valueMode: {
    default: 'id',
    type: String as PropType<UserOrgSelectorValueMode>,
  },
});

const emit = defineEmits<{
  change: [
    selected: null | UserOrgSelectorRecord | UserOrgSelectorRecord[],
    value: UserOrgSelectorModelValue,
  ];
  'dropdown-visible-change': [visible: boolean];
  loaded: [records: UserOrgSelectorRecord[]];
  'update:modelValue': [value: UserOrgSelectorModelValue];
  'update:selectedRecords': [records: UserOrgSelectorRecord[]];
}>();

const loading = ref(false);
const orgTreeData = ref<UserOrgTreeSelectNode[]>([]);
const treeExpandedKeys = ref<string[]>([]);
const searchValue = ref('');
const expandedKeysBeforeSearch = ref<string[]>();
const selectedRecordMap = ref(new Map<string, UserOrgSelectorRecord>());
const loadedOrgNodeKeys = ref(new Set<string>());
const loadingOrgNodeKeys = ref(new Set<string>());
const hasLoadedOrgTree = ref(false);

const normalizedOrgTypes = computed(() =>
  normalizeSelectorTypes(props.orgTypes),
);
const normalizedUserTypes = computed(() =>
  normalizeSelectorTypes(props.userTypes),
);
const normalizedRootOrgIds = computed(() => props.rootOrgIdList);
const allowSelectOrgByMode = computed(() => props.selectableTypes.includes('org'));
const allowSelectUserByMode = computed(() => props.selectableTypes.includes('user'));
const effectiveMultiple = computed(() =>
  props.maxSelectCount === 1 ? false : props.multiple,
);
const activeOrgLoadApi = computed(() => props.orgLoadApi || props.loadOrgTree);
const activeUserLoadApi = computed(() => props.userLoadApi || props.loadUsers);

const nodeMap = computed(() => {
  const map = new Map<string, UserOrgTreeSelectNode>();

  for (const node of flattenUserOrgTreeNodes(orgTreeData.value)) {
    map.set(node.key, node);
  }

  return map;
});

const selectedKeys = computed(() => {
  const values = toModelValueList(props.modelValue);

  return values
    .map((value) => getKeyFromModelValueItem(value))
    .filter(Boolean) as string[];
});

const treeValue = computed(() => {
  if (effectiveMultiple.value) {
    return selectedKeys.value;
  }

  return selectedKeys.value[0];
});

const displayTreeData = computed(() => {
  const existingKeys = new Set(nodeMap.value.keys());
  const selectedGroup = buildSelectedRecordGroupNode(
    [...selectedRecordMap.value.values()],
    existingKeys,
  );

  return selectedGroup
    ? [selectedGroup, ...orgTreeData.value]
    : orgTreeData.value;
});

watch(
  () => props.selectedRecords,
  (records) => {
    mergeSelectedRecords(records || []);
  },
  {
    deep: true,
    immediate: true,
  },
);

watch(
  () => props.modelValue,
  async () => {
    await resolveMissingSelectedRecords();
  },
  {
    deep: true,
    immediate: true,
  },
);

watch(
  () => [
    props.maxLoadDeep,
    props.onlyLeafNode,
    props.onlyNotLeafNode,
    props.onlyShowTypeMatchNode,
    props.orgLoadMode,
    props.orgTypes,
    props.rootOrgIdList,
    props.selectableTypes,
    props.tenantOptions,
    props.showTenantNodes,
  ],
  () => {
    // 首次进入保持空候选，只有已打开过选择器时才随配置变化刷新。
    if (hasLoadedOrgTree.value) {
      void loadOrgTree();
    }
  },
  {
    deep: true,
  },
);

warnInvalidSelectorOptions();

async function handleDropdownVisibleChange(visible: boolean) {
  // 候选树只在用户首次展开时请求，避免页面切换产生无效组织请求。
  if (visible && !hasLoadedOrgTree.value && !loading.value) {
    await loadOrgTree();
  }

  emit('dropdown-visible-change', visible);
}

async function loadOrgTree() {
  loading.value = true;

  try {
    const data = activeOrgLoadApi.value
      ? await activeOrgLoadApi.value(buildOrgLoadContext())
      : await rbacService.fetchAuthorizedOrgTree({
          assembleTree: true,
          rootOrgIdList: normalizedRootOrgIds.value,
        });

    const orgNodes = buildUserOrgSelectorOrgTree(data || [], {
      maxLoadDeep: props.maxLoadDeep,
      onlyLeafNode: props.onlyLeafNode,
      onlyNotLeafNode: props.onlyNotLeafNode,
      onlyShowTypeMatchNode: props.onlyShowTypeMatchNode,
      orgLoadMode: props.orgLoadMode,
      orgTypes: normalizedOrgTypes.value,
      selectableTypes: props.selectableTypes,
    });
    // 平台用户才按租户包装组织根；租户名称优先取组织返回值，缺失时使用授权租户候选补齐。
    if (props.showTenantNodes) {
      const names = new Map(props.tenantOptions.map((item) => [String(item.value), item.label]));
      const groups = new Map<string, UserOrgTreeSelectNode[]>();
      for (const node of orgNodes) {
        const tenantId = node.tenantId || '__platform__';
        groups.set(tenantId, [...(groups.get(tenantId) || []), node]);
      }
      orgTreeData.value = [...groups.entries()].map(([tenantId, children]) =>
        toUserOrgTreeSelectNode({
          id: tenantId,
          kind: 'tenant',
          name: tenantId === '__platform__' ? '平台组织' : children.find((node) => node.tenantName)?.tenantName || names.get(tenantId) || `租户 ${tenantId}`,
          tenantId: tenantId === '__platform__' ? undefined : tenantId,
        }, { children, selectable: props.selectableTypes.includes('tenant') }),
      );
    } else {
      orgTreeData.value = orgNodes;
    }
    hasLoadedOrgTree.value = true;
    emit(
      'loaded',
      flattenUserOrgTreeNodes(orgTreeData.value).filter(
        (node) => node.kind === 'org' && node.selectable === true,
      ),
    );
    treeExpandedKeys.value = [];
    loadedOrgNodeKeys.value = new Set();
  } catch (error) {
    orgTreeData.value = [];
    message.error('加载授权组织失败');
    throw error;
  } finally {
    loading.value = false;
    await resolveMissingSelectedRecords();
  }
}

async function handleLoadData(treeNode: Record<string, any>) {
  const key = String(treeNode.key || treeNode.value || '');
  const node = nodeMap.value.get(key);

  if (!node || node.kind !== 'org') {
    return;
  }

  if (loadedOrgNodeKeys.value.has(key) || loadingOrgNodeKeys.value.has(key)) {
    return;
  }

  const nextLoadingKeys = new Set(loadingOrgNodeKeys.value);
  nextLoadingKeys.add(key);
  loadingOrgNodeKeys.value = nextLoadingKeys;

  try {
    const orgChildren =
      props.orgLoadMode === 'lazy' && !node.loadAttempted && !node.isLeaf
        ? await loadOrgChildren(node)
        : [];
    const users = node.canLoadUsers ? await loadUsersForOrg(node) : [];
    const userNodes = users
      .map((item) => normalizeUserSelectorRecord(item, node))
      .filter((record) => record.id)
      .filter((record) =>
        normalizedUserTypes.value.length === 0
          ? true
          : normalizedUserTypes.value.includes(String(record.type || '')),
      )
      .map((record) =>
        toUserOrgTreeSelectNode(record, {
          isLeaf: true,
          selectable: allowSelectUserByMode.value,
        }),
      );

    node.children = mergeChildrenByKey(node.children || [], [
      ...orgChildren,
      ...userNodes,
    ]);
    node.loadAttempted = true;
    node.hasChildren = orgChildren.length > 0;
    node.isLeaf = orgChildren.length === 0 && userNodes.length === 0;
    orgTreeData.value = [...orgTreeData.value];
    mergeSelectedRecords(userNodes);
    loadedOrgNodeKeys.value = new Set([...loadedOrgNodeKeys.value, key]);
  } catch (error) {
    message.error(`加载“${node.name}”下的数据失败`);
    throw error;
  } finally {
    const nextLoadingKeys = new Set(loadingOrgNodeKeys.value);
    nextLoadingKeys.delete(key);
    loadingOrgNodeKeys.value = nextLoadingKeys;
  }
}

async function loadUsersForOrg(org: UserOrgSelectorRecord) {
  if (activeUserLoadApi.value) {
    return activeUserLoadApi.value({
      org,
      orgId: org.id,
      userTypes: normalizedUserTypes.value,
    });
  }

  const result = await fetchCrudList<Record<string, any>>(
    props.userListPath,
    {
      enable: true,
      inType:
        normalizedUserTypes.value.length > 0
          ? normalizedUserTypes.value
          : undefined,
      loadOrg: true,
      orgId: org.id,
      pageIndex: 1,
      pageSize: props.userPageSize,
    },
    props.userApiModuleBase,
    {
      // 候选用户必须按当前展开组织查询，不能被全局选择状态反向覆盖。
      skipGlobalUserOrgContext: true,
    },
  );

  return result.items || [];
}

async function loadOrgChildren(org: UserOrgTreeSelectNode) {
  const data = activeOrgLoadApi.value
    ? await activeOrgLoadApi.value(
        buildOrgLoadContext({
          depth: (org.depth || 1) + 1,
          parentOrg: org,
          parentOrgId: org.id,
        }),
      )
    : await rbacService.fetchAuthorizedOrgTree({
        assembleTree: true,
        rootOrgIdList: [org.id],
      });

  const childData = extractLazyOrgChildren(data || [], org.id);

  return buildUserOrgSelectorOrgTree(childData, {
    depth: (org.depth || 1) + 1,
    maxLoadDeep: props.maxLoadDeep,
    onlyLeafNode: props.onlyLeafNode,
    onlyNotLeafNode: props.onlyNotLeafNode,
    onlyShowTypeMatchNode: props.onlyShowTypeMatchNode,
    orgLoadMode: props.orgLoadMode,
    orgTypes: normalizedOrgTypes.value,
  });
}

function extractLazyOrgChildren(
  data: Record<string, any>[],
  parentOrgId: string,
) {
  if (data.length === 1 && String(data[0]?.id ?? '') === parentOrgId) {
    const children =
      data[0]?.children ||
      data[0]?.childList ||
      data[0]?.subList ||
      data[0]?.orgList ||
      [];

    return Array.isArray(children) ? children : [];
  }

  return data;
}

function buildOrgLoadContext(
  extra: Partial<{
    depth: number;
    parentOrg: UserOrgSelectorRecord;
    parentOrgId: string;
  }> = {},
) {
  const rootOrgIdList = normalizedRootOrgIds.value;

  return {
    depth: extra.depth || 1,
    maxLoadDeep: props.maxLoadDeep,
    selectableTypes: props.selectableTypes,
    onlyLeafNode: props.onlyLeafNode,
    onlyNotLeafNode: props.onlyNotLeafNode,
    onlyShowTypeMatchNode: props.onlyShowTypeMatchNode,
    orgLoadMode: props.orgLoadMode,
    orgTypes: normalizedOrgTypes.value,
    parentOrg: extra.parentOrg,
    parentOrgId: extra.parentOrgId,
    rootOrgIdList,
  };
}

function handleChange(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const records = enforceSelectionLimit(
    values
      .map((item) => getRecordByKey(item))
      .filter(Boolean) as UserOrgSelectorRecord[],
  );

  mergeSelectedRecords(records);

  const nextValue =
    props.valueMode === 'record'
      ? getRecordModelValue(records)
      : getIdModelValue(records);

  emit('update:modelValue', nextValue);
  emit('update:selectedRecords', records);
  emit(
    'change',
    effectiveMultiple.value ? records : records[0] || null,
    nextValue,
  );
}

function getRecordModelValue(records: UserOrgSelectorRecord[]) {
  if (effectiveMultiple.value) {
    return records;
  }

  return records[0] || null;
}

function getIdModelValue(records: UserOrgSelectorRecord[]) {
  if (effectiveMultiple.value) {
    return records.map((record) => record.id);
  }

  return records[0]?.id;
}

function warnInvalidSelectorOptions() {
  if (props.onlyLeafNode && props.onlyNotLeafNode) {
    console.warn(
      '[UserOrgSelector] onlyLeafNode and onlyNotLeafNode cannot both be true.',
    );
  }
}

function enforceSelectionLimit(records: UserOrgSelectorRecord[]) {
  const result = limitUserOrgSelectorRecords(records, props.maxSelectCount);

  if (result.limited && props.maxSelectCount > 1) {
    message.warning(`最多只能选择 ${props.maxSelectCount} 项`);
  }

  return result.records;
}

function toModelValueList(value: UserOrgSelectorModelValue) {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined || value === null || value === '' ? [] : [value];
}

function getKeyFromModelValueItem(
  value: string | UserOrgSelectorRecord,
): string | undefined {
  if (typeof value === 'object') {
    rememberSelectedRecord(value);
    return encodeUserOrgSelectorKey(value.kind, value.id);
  }

  const normalizedValue = String(value || '');

  if (decodeUserOrgSelectorKey(normalizedValue)) {
    return normalizedValue;
  }

  const record = getKnownRecordById(normalizedValue);

  if (record) {
    return encodeUserOrgSelectorKey(record.kind, record.id);
  }

  if (props.selectableTypes.length === 1) {
    return encodeUserOrgSelectorKey(props.selectableTypes[0]!, normalizedValue);
  }

  return undefined;
}

function getRecordByKey(key: string) {
  const node = nodeMap.value.get(key);

  if (node) {
    return toRecord(node);
  }

  const decoded = decodeUserOrgSelectorKey(key);

  if (!decoded) {
    return undefined;
  }

  return selectedRecordMap.value.get(
    encodeUserOrgSelectorKey(decoded.kind, decoded.id),
  );
}

function getKnownRecordById(id: string) {
  for (const record of selectedRecordMap.value.values()) {
    if (record.id === id) {
      return record;
    }
  }

  for (const node of nodeMap.value.values()) {
    if (node.id === id) {
      return toRecord(node);
    }
  }
}

function toRecord(
  node: UserOrgSelectorRecord | UserOrgTreeSelectNode,
): UserOrgSelectorRecord {
  return {
    id: node.id,
    kind: node.kind,
    name: node.name,
    orgId: node.orgId,
    orgName: node.orgName,
    raw: node.raw,
    tenantId: node.tenantId,
    type: node.type,
  };
}

function rememberSelectedRecord(record: UserOrgSelectorRecord) {
  if (!record?.id || !record.kind) {
    return;
  }

  const key = encodeUserOrgSelectorKey(record.kind, record.id);
  const nextMap = new Map(selectedRecordMap.value);
  nextMap.set(key, toRecord(record));
  selectedRecordMap.value = nextMap;
}

function mergeSelectedRecords(records: UserOrgSelectorRecord[]) {
  if (records.length === 0) {
    return;
  }

  const nextMap = new Map(selectedRecordMap.value);

  for (const record of records) {
    if (!record?.id || !record.kind) {
      continue;
    }

    nextMap.set(
      encodeUserOrgSelectorKey(record.kind, record.id),
      toRecord(record),
    );
  }

  selectedRecordMap.value = nextMap;
}

async function resolveMissingSelectedRecords() {
  if (!props.resolveRecords) {
    return;
  }

  const unresolvedIds = toModelValueList(props.modelValue)
    .filter((value): value is string => typeof value === 'string')
    .filter((value) => !decodeUserOrgSelectorKey(value))
    .filter((value) => !getKnownRecordById(value));

  if (unresolvedIds.length === 0) {
    return;
  }

  const records = await props.resolveRecords([...new Set(unresolvedIds)]);
  mergeSelectedRecords(records || []);
}

function mergeChildrenByKey(
  oldChildren: UserOrgTreeSelectNode[],
  newChildren: UserOrgTreeSelectNode[],
) {
  const map = new Map<string, UserOrgTreeSelectNode>();

  for (const child of oldChildren) {
    map.set(child.key, child);
  }

  for (const child of newChildren) {
    map.set(child.key, child);
  }

  return [...map.values()];
}

function getSearchExpandedKeys(
  nodes: UserOrgTreeSelectNode[],
  keyword: string,
  ancestorKeys: string[] = [],
) {
  const expandedKeys = new Set<string>();

  for (const node of nodes) {
    const nodeTitle = String(node.title || '').toLocaleLowerCase();
    const isMatched = nodeTitle.includes(keyword);
    const nextAncestorKeys = [...ancestorKeys, node.key];

    if (isMatched) {
      ancestorKeys.forEach((key) => expandedKeys.add(key));
      if (node.children?.length) {
        expandedKeys.add(node.key);
      }
    }

    getSearchExpandedKeys(node.children || [], keyword, nextAncestorKeys).forEach(
      (key) => expandedKeys.add(key),
    );
  }

  return [...expandedKeys];
}

function getNodeTitleParts(title: string) {
  const keyword = searchValue.value.trim();

  if (!keyword) {
    return [{ highlighted: false, text: title }];
  }

  const normalizedTitle = title.toLocaleLowerCase();
  const normalizedKeyword = keyword.toLocaleLowerCase();
  const parts: Array<{ highlighted: boolean; text: string }> = [];
  let offset = 0;
  let matchIndex = normalizedTitle.indexOf(normalizedKeyword, offset);

  while (matchIndex >= 0) {
    if (matchIndex > offset) {
      parts.push({ highlighted: false, text: title.slice(offset, matchIndex) });
    }
    parts.push({
      highlighted: true,
      text: title.slice(matchIndex, matchIndex + keyword.length),
    });
    offset = matchIndex + keyword.length;
    matchIndex = normalizedTitle.indexOf(normalizedKeyword, offset);
  }

  if (offset < title.length) {
    parts.push({ highlighted: false, text: title.slice(offset) });
  }

  return parts.length > 0 ? parts : [{ highlighted: false, text: title }];
}

function handleSearch(value: string) {
  const keyword = value.trim().toLocaleLowerCase();

  if (!keyword) {
    searchValue.value = '';
    treeExpandedKeys.value = expandedKeysBeforeSearch.value || [];
    expandedKeysBeforeSearch.value = undefined;
    return;
  }

  if (!searchValue.value) {
    expandedKeysBeforeSearch.value = [...treeExpandedKeys.value];
  }

  searchValue.value = value;
  treeExpandedKeys.value = getSearchExpandedKeys(orgTreeData.value, keyword);
}
</script>

<template>
  <TreeSelect
    :allow-clear="allowClear"
    :disabled="disabled"
    :load-data="handleLoadData"
    :loading="loading"
    :multiple="effectiveMultiple"
    :dropdown-match-select-width="false"
    :placeholder="placeholder"
    popup-class-name="user-org-selector__dropdown"
    :show-search="showSearch"
    :tree-checkable="effectiveMultiple"
    :tree-data="displayTreeData"
    :value="treeValue"
    :virtual="false"
    class="w-full"
    tree-node-filter-prop="title"
    v-model:tree-expanded-keys="treeExpandedKeys"
    @change="handleChange"
    @dropdown-visible-change="handleDropdownVisibleChange"
    @search="handleSearch"
  >
    <template #title="node">
      <span
        :class="[
          'user-org-selector__node-title',
          {
            'user-org-selector__disabled-org-title':
              node.kind === 'org' && node.disabled,
          },
        ]"
      >
        <IconifyIcon
          v-if="showNodeIcons"
          :icon="getUserOrgSelectorNodeIcon(node)"
          class="user-org-selector__node-icon"
        />
        <span>
          <template
            v-for="(part, index) in getNodeTitleParts(String(node.title || ''))"
            :key="`${node.key}-${index}`"
          >
            <mark
              v-if="part.highlighted"
              class="user-org-selector__node-highlight"
            >
              {{ part.text }}
            </mark>
            <template v-else>{{ part.text }}</template>
          </template>
        </span>
      </span>
    </template>
  </TreeSelect>
</template>

<style>
.user-org-selector__node-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.user-org-selector__node-icon {
  flex: 0 0 auto;
  font-size: 1em;
}

.user-org-selector__disabled-org-title {
  color: hsl(var(--foreground) / 0.6667);
}

.user-org-selector__node-highlight {
  padding: 0;
  color: inherit;
  background: hsl(var(--primary) / 0.16);
  border-radius: 2px;
}

/* 公共组织与用户树：候选区自行滚动，避免深层节点挤压中文标题。 */
.user-org-selector__dropdown {
  width: max-content !important;
  max-width: min(640px, calc(100vw - 32px));
}

.user-org-selector__dropdown .ant-select-tree-list-holder {
  max-height: 80vh !important;
  overflow: auto !important;
}

.user-org-selector__dropdown .ant-select-tree-list-holder-inner {
  display: inline-block;
  min-width: 100%;
  width: max-content;
}

.user-org-selector__dropdown .ant-select-tree-node-content-wrapper {
  white-space: nowrap;
}
</style>
