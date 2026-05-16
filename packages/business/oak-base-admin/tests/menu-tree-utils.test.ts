import { describe, expect, it } from 'vitest';

import {
  buildMenuTree,
  buildParentTreeOptions,
  collectMenuSubtreeIdsFromRows,
  collectMenuSubtreeIds,
  toMenuFormRecord,
} from '../src/modules/com_levin_oak_base/views/menu/menu-tree-utils';

describe('menu tree utils', () => {
  it('builds a sorted tree and keeps child parent ids', () => {
    const tree = buildMenuTree([
      { id: 'child-b', name: 'B', orderCode: 2, parentId: 'root' },
      { id: 'root', name: 'Root', orderCode: 1 },
      { id: 'child-a', name: 'A', orderCode: 1, parent: { id: 'root' } },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children?.map((item) => item.id)).toEqual([
      'child-a',
      'child-b',
    ]);
    expect(tree[0]?.children?.[0]?.parentId).toBe('root');
  });

  it('collects descendants before current menu for delete', () => {
    const ids = collectMenuSubtreeIds({
      children: [
        { id: 'child-1' },
        { children: [{ id: 'grandchild-1' }], id: 'child-2' },
      ],
      id: 'root',
    });

    expect(ids).toEqual(['child-1', 'grandchild-1', 'child-2', 'root']);
  });

  it('collects unique subtree ids from multiple selected menus', () => {
    const child = { id: 'child' };
    const ids = collectMenuSubtreeIdsFromRows([
      { children: [child], id: 'root' },
      child,
      { id: 'sibling' },
    ]);

    expect(ids).toEqual(['child', 'root', 'sibling']);
  });

  it('disables current menu and descendants as parent candidates', () => {
    const options = buildParentTreeOptions(
      [
        {
          children: [{ id: 'child', name: 'Child' }],
          id: 'root',
          name: 'Root',
        },
        { id: 'sibling', name: 'Sibling' },
      ],
      'root',
    );

    expect(options[0]?.disabled).toBe(true);
    expect(options[0]?.children?.[0]?.disabled).toBe(true);
    expect(options[1]?.disabled).toBe(false);
  });

  it('removes tree-only fields before editing', () => {
    const record = toMenuFormRecord({
      children: [{ id: 'child' }],
      id: 'root',
      name: 'Root',
      parent: { id: 'parent' },
    });

    expect(record).toEqual({
      id: 'root',
      name: 'Root',
      parentId: 'parent',
    });
  });
});
