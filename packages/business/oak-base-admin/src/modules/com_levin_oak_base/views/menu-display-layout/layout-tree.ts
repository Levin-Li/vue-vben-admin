export interface MenuDisplayLayoutItem {
  children?: MenuDisplayLayoutItem[];
  enable?: boolean;
  key: string;
  label: string;
  path?: string;
}

export interface MenuDisplaySource {
  children?: MenuDisplaySource[];
  enable?: boolean;
  icon?: string;
  id?: string;
  key?: string;
  label?: string;
  name?: string;
  orderCode?: number;
  parentId?: string;
  path?: string;
  title?: string;
}

export type LayoutMoveDirection = 'down' | 'up';

export function canDragLayoutItem(key: string, virtualRootKey: string) {
  return key !== virtualRootKey;
}

export function cloneLayoutItems(items: MenuDisplayLayoutItem[] = []) {
  return items.map((item) => ({
    ...item,
    children: cloneLayoutItems(item.children),
  }));
}

export function toPersistedLayoutItems(items: MenuDisplayLayoutItem[] = []) {
  return items.map(({ children, enable, label, path }) => ({
    ...(children?.length ? { children: toPersistedLayoutItems(children) } : {}),
    ...(enable === false ? { enable: false } : {}),
    label,
    ...(path ? { path } : {}),
  }));
}

export function collectLayoutPaths(items: MenuDisplayLayoutItem[] = []) {
  const paths = new Set<string>();

  for (const item of items) {
    const path = String(item.path || '').trim();
    if (path) {
      paths.add(path);
    }
    collectLayoutPaths(item.children).forEach((value) => paths.add(value));
  }

  return paths;
}

export function findLayoutItem(
  items: MenuDisplayLayoutItem[],
  key: string,
): MenuDisplayLayoutItem | undefined {
  for (const item of items) {
    if (item.key === key) {
      return item;
    }
    const child = findLayoutItem(item.children || [], key);
    if (child) {
      return child;
    }
  }

  return undefined;
}

export function updateLayoutItemValue(
  items: MenuDisplayLayoutItem[],
  key: string,
  field: 'enable' | 'label',
  value: boolean | string,
) {
  const item = findLayoutItem(items, key);
  if (!item) {
    return false;
  }

  if (field === 'enable') {
    item.enable = Boolean(value);
  } else {
    item.label = String(value);
  }
  return true;
}

export function removeLayoutItem(
  items: MenuDisplayLayoutItem[],
  key: string,
): MenuDisplayLayoutItem | undefined {
  const index = items.findIndex((item) => item.key === key);
  if (index >= 0) {
    return items.splice(index, 1)[0];
  }

  for (const item of items) {
    const removed = removeLayoutItem(item.children || [], key);
    if (removed) {
      return removed;
    }
  }

  return undefined;
}

export function appendLayoutItem(
  items: MenuDisplayLayoutItem[],
  parentKey: string | undefined,
  item: MenuDisplayLayoutItem,
) {
  if (!parentKey) {
    items.push(item);
    return true;
  }

  const parent = findLayoutItem(items, parentKey);
  if (!parent) {
    return false;
  }

  parent.children ||= [];
  parent.children.push(item);
  return true;
}

export function appendLayoutItemAtTarget(
  items: MenuDisplayLayoutItem[],
  virtualRootKey: string,
  targetKey: string,
  item: MenuDisplayLayoutItem,
) {
  if (targetKey === virtualRootKey) {
    items.push(item);
    return true;
  }

  return appendLayoutItem(items, targetKey, item);
}

export function hasLayoutPathAtTarget(
  items: MenuDisplayLayoutItem[],
  virtualRootKey: string,
  targetKey: string,
  path: string,
) {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath) {
    return false;
  }

  const siblings =
    targetKey === virtualRootKey
      ? items
      : findLayoutItem(items, targetKey)?.children || [];
  return siblings.some(
    (item) => String(item.path || '').trim() === normalizedPath,
  );
}

export function appendLayoutItemsAtTarget(
  items: MenuDisplayLayoutItem[],
  virtualRootKey: string,
  targetKey: string,
  candidates: MenuDisplayLayoutItem[],
) {
  let added = 0;
  let skipped = 0;

  for (const item of candidates) {
    if (
      hasLayoutPathAtTarget(
        items,
        virtualRootKey,
        targetKey,
        item.path || '',
      )
    ) {
      skipped += 1;
      continue;
    }

    if (appendLayoutItemAtTarget(items, virtualRootKey, targetKey, item)) {
      added += 1;
    } else {
      skipped += 1;
    }
  }

  return { added, skipped };
}

export function insertLayoutItemBeside(
  items: MenuDisplayLayoutItem[],
  targetKey: string,
  item: MenuDisplayLayoutItem,
  after = false,
): boolean {
  const index = items.findIndex((candidate) => candidate.key === targetKey);
  if (index >= 0) {
    items.splice(index + (after ? 1 : 0), 0, item);
    return true;
  }

  return items.some((candidate) =>
    insertLayoutItemBeside(candidate.children || [], targetKey, item, after),
  );
}

export function canMoveLayoutItem(
  items: MenuDisplayLayoutItem[],
  key: string,
  direction: LayoutMoveDirection,
): boolean {
  const index = items.findIndex((item) => item.key === key);
  if (index >= 0) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    return targetIndex >= 0 && targetIndex < items.length;
  }

  return items.some((item) =>
    canMoveLayoutItem(item.children || [], key, direction),
  );
}

export function moveLayoutItem(
  items: MenuDisplayLayoutItem[],
  key: string,
  direction: LayoutMoveDirection,
): boolean {
  const index = items.findIndex((item) => item.key === key);
  if (index >= 0) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) {
      return false;
    }

    [items[index], items[targetIndex]] = [items[targetIndex]!, items[index]!];
    return true;
  }

  return items.some((item) =>
    moveLayoutItem(item.children || [], key, direction),
  );
}

export function toLayoutItem(source: MenuDisplaySource): MenuDisplayLayoutItem {
  const path = String(source.path || '').trim();
  const label =
    source.label || source.name || source.title || path || '未命名菜单';

  return {
    enable: source.enable !== false,
    key: `menu:${path}`,
    label,
    path,
  };
}

export function flattenMenuSources(items?: MenuDisplaySource[]) {
  const result: MenuDisplaySource[] = [];

  for (const item of Array.isArray(items) ? items : []) {
    result.push(item);
    result.push(...flattenMenuSources(item.children));
  }

  return result;
}

export function keepLayoutRootExpanded(
  keys: Array<number | string>,
  rootKey: string,
) {
  return [...new Set([rootKey, ...keys.map(String)])];
}
