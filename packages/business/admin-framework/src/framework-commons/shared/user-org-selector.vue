<script setup lang="ts">
import type { PropType } from 'vue';
import type {
  UserOrgSelectorLoadOrgTree,
  UserOrgSelectorLoadUsers,
  UserOrgSelectorMode,
  UserOrgSelectorModelValue,
  UserOrgSelectorRecord,
  UserOrgSelectorResolveRecords,
  UserOrgSelectorValueMode,
  UserOrgTreeSelectNode,
} from './user-org-selector-types';

import { computed, onMounted, ref, watch } from 'vue';

import { TreeSelect, message } from 'ant-design-vue';

import { fetchCrudList } from '../api';
import { rbacService } from '../app/api/rbac-service';
import {
  buildSelectedRecordGroupNode,
  buildUserOrgSelectorOrgTree,
  decodeUserOrgSelectorKey,
  encodeUserOrgSelectorKey,
  flattenUserOrgTreeNodes,
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
  disabled: {
    default: false,
    type: Boolean,
  },
  loadUsers: {
    type: Function as PropType<UserOrgSelectorLoadUsers>,
  },
  loadOrgTree: {
    type: Function as PropType<UserOrgSelectorLoadOrgTree>,
  },
  mode: {
    default: 'both',
    type: String as PropType<UserOrgSelectorMode>,
  },
  modelValue: {
    type: [Array, Object, String] as PropType<UserOrgSelectorModelValue>,
  },
  multiple: {
    default: false,
    type: Boolean,
  },
  orgRootIds: {
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
  showSearch: {
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
  'update:modelValue': [value: UserOrgSelectorModelValue];
  'update:selectedRecords': [records: UserOrgSelectorRecord[]];
}>();

const loading = ref(false);
const orgTreeData = ref<UserOrgTreeSelectNode[]>([]);
const treeExpandedKeys = ref<string[]>([]);
const selectedRecordMap = ref(new Map<string, UserOrgSelectorRecord>());
const loadedUserOrgKeys = ref(new Set<string>());
const loadingUserOrgKeys = ref(new Set<string>());

const normalizedOrgTypes = computed(() =>
  normalizeSelectorTypes(props.orgTypes),
);
const normalizedUserTypes = computed(() =>
  normalizeSelectorTypes(props.userTypes),
);

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
  if (props.multiple) {
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
  () => [props.mode, props.orgTypes, props.orgRootIds],
  () => {
    void loadOrgTree();
  },
  {
    deep: true,
  },
);

onMounted(() => {
  void loadOrgTree();
});

async function loadOrgTree() {
  loading.value = true;

  try {
    const data = props.loadOrgTree
      ? await props.loadOrgTree({
          mode: props.mode,
          orgRootIds: props.orgRootIds,
          orgTypes: normalizedOrgTypes.value,
        })
      : await rbacService.fetchAuthorizedOrgTree({
          assembleTree: true,
          rootOrgIdList: props.orgRootIds,
        });

    orgTreeData.value = buildUserOrgSelectorOrgTree(data || [], {
      mode: props.mode,
      orgTypes: normalizedOrgTypes.value,
    });
    treeExpandedKeys.value = [];
    loadedUserOrgKeys.value = new Set();
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

  if (!node || node.kind !== 'org' || !node.canLoadUsers) {
    return;
  }

  if (loadedUserOrgKeys.value.has(key) || loadingUserOrgKeys.value.has(key)) {
    return;
  }

  const nextLoadingKeys = new Set(loadingUserOrgKeys.value);
  nextLoadingKeys.add(key);
  loadingUserOrgKeys.value = nextLoadingKeys;

  try {
    const users = await loadUsersForOrg(node);
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
          selectable: props.mode === 'both' || props.mode === 'user',
        }),
      );

    node.children = mergeChildrenByKey(node.children || [], userNodes);
    node.isLeaf = (node.children || []).length === 0;
    orgTreeData.value = [...orgTreeData.value];
    mergeSelectedRecords(userNodes);
    loadedUserOrgKeys.value = new Set([...loadedUserOrgKeys.value, key]);
  } catch (error) {
    message.error(`加载“${node.name}”下的用户失败`);
    throw error;
  } finally {
    const nextLoadingKeys = new Set(loadingUserOrgKeys.value);
    nextLoadingKeys.delete(key);
    loadingUserOrgKeys.value = nextLoadingKeys;
  }
}

async function loadUsersForOrg(org: UserOrgSelectorRecord) {
  if (props.loadUsers) {
    return props.loadUsers({
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
  );

  return result.items || [];
}

function handleChange(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const records = values
    .map((item) => getRecordByKey(item))
    .filter(Boolean) as UserOrgSelectorRecord[];

  mergeSelectedRecords(records);

  const nextValue =
    props.valueMode === 'record'
      ? getRecordModelValue(records)
      : getIdModelValue(records);

  emit('update:modelValue', nextValue);
  emit('update:selectedRecords', records);
  emit('change', props.multiple ? records : records[0] || null, nextValue);
}

function getRecordModelValue(records: UserOrgSelectorRecord[]) {
  if (props.multiple) {
    return records;
  }

  return records[0] || null;
}

function getIdModelValue(records: UserOrgSelectorRecord[]) {
  if (props.multiple) {
    return records.map((record) => record.id);
  }

  return records[0]?.id;
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

  if (props.mode === 'org' || props.mode === 'user') {
    return encodeUserOrgSelectorKey(props.mode, normalizedValue);
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
</script>

<template>
  <TreeSelect
    :allow-clear="allowClear"
    :disabled="disabled"
    :load-data="handleLoadData"
    :loading="loading"
    :multiple="multiple"
    :placeholder="placeholder"
    :show-search="showSearch"
    :tree-checkable="multiple"
    :tree-data="displayTreeData"
    :value="treeValue"
    class="w-full"
    tree-node-filter-prop="title"
    v-model:tree-expanded-keys="treeExpandedKeys"
    @change="handleChange"
  />
</template>
