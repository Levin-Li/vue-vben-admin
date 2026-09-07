import { describe, expect, it } from 'vitest';

import {
  collectMenuSubtreeIds,
  flattenMenuRows,
  indexMenuTree,
  normalizeMenuTree,
} from '../menu-tree-utils';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('缺少测试数据');
  return value;
}

describe('菜单虚拟树的数据完整性', () => {
  const tree = () =>
    normalizeMenuTree([
      {
        id: 'root',
        name: '根',
        children: [
          { id: 'b', name: '乙', orderCode: 20 },
          {
            id: 'a',
            name: '甲',
            orderCode: 10,
            children: [{ id: 'leaf', name: '末级' }],
          },
        ],
      },
    ]);
  it('平铺保留层级ID及顺序，不携带共享children或修改原树', () => {
    const source = tree();
    const before = JSON.stringify(source);
    const flat = flattenMenuRows(source);
    expect(flat.map((row) => [row.id, row.parentId])).toEqual([
      ['root', ''],
      ['a', 'root'],
      ['leaf', 'a'],
      ['b', 'root'],
    ]);
    expect(
      flat.every(
        (row) =>
          !Object.hasOwn(row, 'children') && !Object.hasOwn(row, 'parent'),
      ),
    ).toBe(true);
    required(flat[0]).name = '表格副本';
    expect(JSON.stringify(source)).toBe(before);
  });
  it('兄弟索引只共享本层集合，首尾和子树仍完整', () => {
    const index = indexMenuTree(tree());
    expect(index.positions.get('a')?.index).toBe(0);
    expect(index.positions.get('b')?.index).toBe(1);
    expect(index.positions.get('a')?.siblings).toBe(
      index.positions.get('b')?.siblings,
    );
    expect(index.positions.get('leaf')?.siblings.map((row) => row.id)).toEqual([
      'leaf',
    ]);
    expect(collectMenuSubtreeIds(required(index.byId.get('root')))).toEqual([
      'leaf',
      'a',
      'b',
      'root',
    ]);
  });
  it('数据重新排序后索引更新，缺少ID的节点不获得移动资格', () => {
    const source = tree();
    required(required(source[0]).children?.[1]).orderCode = 0;
    const index = indexMenuTree([...source, { name: '无ID' }]);
    expect(index.positions.get('b')?.index).toBe(0);
    expect(index.positions.has('')).toBe(false);
  });
});
