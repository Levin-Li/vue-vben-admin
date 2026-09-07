import type { DataNode } from 'ant-design-vue/es/tree';

import type { MenuRecord } from './types';

import { parseMenuFixedQuery } from '@levin/admin-framework/framework-commons/menu-fixed-query';

export function getMenuParentId(row: MenuRecord, fallbackParentId = '') {
  return row.parentId || row.parent?.id || fallbackParentId;
}

export function sortMenuRows(rows: MenuRecord[]) {
  return rows.toSorted((a, b) => {
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

export function isMenuInSubtree(row: MenuRecord, id?: string): boolean {
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
      children: buildParentTreeOptions(
        row.children || [],
        disabledId,
        disabled,
      ),
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

/** 复制为尚未保存的新菜单，不携带源菜单标识、审计或子节点。 */
export function copyMenuFormRecord(row: MenuRecord): MenuRecord {
  const {
    id: _id,
    createTime: _created,
    lastUpdateTime: _updated,
    optimisticLock: _lock,
    ...record
  } = toMenuFormRecord(row);
  return {
    ...record,
    params: parseMenuFixedQuery(record.params),
    name: `${row.name || '菜单'}（副本）`,
    path: `/menu-entry/${crypto.randomUUID()}`,
    requireAuthorizations: record.requireAuthorizations
      ? [...record.requireAuthorizations]
      : [],
    opButtonList: record.opButtonList?.map((op) => ({
      ...op,
      requireAuthorizations: op.requireAuthorizations
        ? [...op.requireAuthorizations]
        : [],
    })),
  };
}

/** 业务树独立保留，表格仅接收带父ID的平铺副本，避免虚拟滚动改写业务子树。 */
export function flattenMenuRows(rows: MenuRecord[]): MenuRecord[] {
  return rows.flatMap((row) => {
    const { children, parent: _parent, ...item } = row;
    return [
      { ...item, parentId: getMenuParentId(row) },
      ...flattenMenuRows(children || []),
    ];
  });
}

/** 每个兄弟集合只排序一次，渲染阶段直接查询位置。 */
export function indexMenuTree(rows: MenuRecord[]) {
  const byId = new Map<string, MenuRecord>();
  const positions = new Map<
    string,
    { index: number; siblings: MenuRecord[] }
  >();
  function visit(items: MenuRecord[]) {
    const siblings = sortMenuRows(items).filter((row) => row.id);
    siblings.forEach((row, index) => {
      if (row.id) {
        byId.set(row.id, row);
        positions.set(row.id, { siblings, index });
      }
    });
    for (const row of items) visit(row.children || []);
  }
  visit(rows);
  return { byId, positions };
}
