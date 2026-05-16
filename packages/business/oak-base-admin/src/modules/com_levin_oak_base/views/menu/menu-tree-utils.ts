import type { DataNode } from 'ant-design-vue/es/tree';

import type { MenuRecord } from './types';

export function getMenuParentId(row: MenuRecord, fallbackParentId = '') {
  return row.parentId || row.parent?.id || fallbackParentId;
}

export function sortMenuRows(rows: MenuRecord[]) {
  return [...rows].sort((a, b) => {
    const orderA = a.orderCode ?? 0;
    const orderB = b.orderCode ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return String(a.name || '').localeCompare(
      String(b.name || ''),
      'zh-Hans-CN',
    );
  });
}

export function normalizeMenuTree(
  rows: MenuRecord[],
  parentId = '',
): MenuRecord[] {
  return sortMenuRows(
    rows.map((row) => {
      const currentParentId = getMenuParentId(row, parentId);
      return {
        ...row,
        children: normalizeMenuTree(row.children || [], row.id || ''),
        parentId: currentParentId,
      };
    }),
  );
}

export function buildMenuTree(rows: MenuRecord[]) {
  const normalizedRows = rows.map((row) => ({
    ...row,
    children: [],
    parentId: getMenuParentId(row),
  }));
  const rowMap = new Map<string, MenuRecord>();
  const roots: MenuRecord[] = [];

  normalizedRows.forEach((row) => {
    if (row.id) {
      rowMap.set(row.id, row);
    }
  });

  normalizedRows.forEach((row) => {
    const parent = row.parentId ? rowMap.get(row.parentId) : undefined;
    if (parent && parent.id !== row.id) {
      parent.children = [...(parent.children || []), row];
    } else {
      roots.push(row);
    }
  });

  return normalizeMenuTree(roots);
}

export function collectMenuSubtreeIds(row: MenuRecord): string[] {
  const ids: string[] = [];

  for (const child of row.children || []) {
    ids.push(...collectMenuSubtreeIds(child));
  }

  if (row.id) {
    ids.push(row.id);
  }

  return ids;
}

export function collectMenuSubtreeIdsFromRows(rows: MenuRecord[]): string[] {
  const idSet = new Set<string>();

  rows.forEach((row) => {
    collectMenuSubtreeIds(row).forEach((id) => idSet.add(id));
  });

  return [...idSet];
}

export function isMenuInSubtree(row: MenuRecord, id?: string) {
  if (!id) {
    return false;
  }

  if (row.id === id) {
    return true;
  }

  return (row.children || []).some((child) => isMenuInSubtree(child, id));
}

export function buildParentTreeOptions(
  rows: MenuRecord[],
  disabledId?: string,
  ancestorDisabled = false,
): DataNode[] {
  return rows.map((row) => {
    const disabled = ancestorDisabled || row.id === disabledId;
    return {
      children: buildParentTreeOptions(row.children || [], disabledId, disabled),
      disabled,
      key: row.id || '',
      title: row.name || row.label || row.path || row.id || '未命名菜单',
      value: row.id || '',
    };
  });
}

export function toMenuFormRecord(row: MenuRecord): MenuRecord {
  const { children: _children, parent: _parent, ...record } = row;
  return {
    ...record,
    parentId: getMenuParentId(row),
  };
}
