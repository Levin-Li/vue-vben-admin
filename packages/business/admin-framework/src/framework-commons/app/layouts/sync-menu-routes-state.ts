import type { SyncMenuItem } from '@levin/admin-framework/framework-commons/app/utils/sync-menu-routes';

export type EditableSyncMenuItem = SyncMenuItem & {
  children?: EditableSyncMenuItem[];
  key: string;
};

export type SyncMenuBooleanField = 'enable' | 'overrideExisting';

export function flattenSyncMenuItems(
  list: EditableSyncMenuItem[],
): EditableSyncMenuItem[] {
  return list.flatMap((item) => [
    item,
    ...flattenSyncMenuItems(item.children || []),
  ]);
}

export function countSyncMenuItems(list: EditableSyncMenuItem[]): number {
  return list.reduce(
    (total, item) => total + 1 + countSyncMenuItems(item.children || []),
    0,
  );
}

export function toEditableSyncMenuItems(
  list: SyncMenuItem[],
  keyPrefix = 'route',
): EditableSyncMenuItem[] {
  return list.map((item, index) => {
    const key = `${keyPrefix}-${index}`;
    return {
      ...item,
      children: toEditableSyncMenuItems(item.children || [], key),
      key,
    };
  });
}

export function getSelfAndDescendantSyncMenuKeys(
  item: EditableSyncMenuItem,
): string[] {
  return [
    item.key,
    ...flattenSyncMenuItems(item.children || []).map((child) => child.key),
  ];
}

export function syncAncestorKeysFromLeaves(
  list: EditableSyncMenuItem[],
  keys: Set<string>,
) {
  function syncNodeFromLeaves(item: EditableSyncMenuItem) {
    const children = item.children || [];

    if (children.length === 0) {
      return keys.has(item.key);
    }

    const allChildrenChecked = children.map(syncNodeFromLeaves).every(Boolean);

    if (allChildrenChecked) {
      keys.add(item.key);
    } else {
      keys.delete(item.key);
    }

    return keys.has(item.key);
  }

  list.forEach(syncNodeFromLeaves);
  return keys;
}

export function toggleSyncMenuTreeKeys(
  list: EditableSyncMenuItem[],
  currentKeys: Set<string>,
  record: EditableSyncMenuItem,
  checked: boolean,
) {
  const nextKeys = new Set(currentKeys);
  const targetKeys = getSelfAndDescendantSyncMenuKeys(record);

  targetKeys.forEach((key) => {
    if (checked) {
      nextKeys.add(key);
    } else {
      nextKeys.delete(key);
    }
  });

  return syncAncestorKeysFromLeaves(list, nextKeys);
}

export function hasCheckedDescendant(
  record: EditableSyncMenuItem,
  keys: Set<string>,
): boolean {
  return (record.children || []).some(
    (child) => keys.has(child.key) || hasCheckedDescendant(child, keys),
  );
}

export function isSyncMenuRowIndeterminate(
  record: EditableSyncMenuItem,
  keys: Set<string>,
) {
  return !keys.has(record.key) && hasCheckedDescendant(record, keys);
}

export function removeSyncMenuItemByKey(
  list: EditableSyncMenuItem[],
  key: string,
): EditableSyncMenuItem[] {
  return list
    .filter((item) => item.key !== key)
    .map((item) => ({
      ...item,
      children: removeSyncMenuItemByKey(item.children || [], key),
    }));
}

export function toSelectedSyncMenuItems(
  list: EditableSyncMenuItem[],
  selectedKeys: Set<string>,
  options: Record<SyncMenuBooleanField, Set<string>>,
): SyncMenuItem[] {
  return list.flatMap(({ children, key, ...item }) => {
    const selectedChildren = toSelectedSyncMenuItems(
      children || [],
      selectedKeys,
      options,
    );

    if (!selectedKeys.has(key) && selectedChildren.length === 0) {
      return [];
    }

    return [
      {
        ...item,
        children: selectedChildren,
        enable: options.enable.has(key),
        overrideExisting: options.overrideExisting.has(key),
      },
    ];
  });
}
