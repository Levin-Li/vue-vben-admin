import { describe, expect, it } from 'vitest';

import type { UserOrgSelectorLoadOrgTree } from '../user-org-selector-types';

import {
  buildUserOrgSelectorOrgTree,
  decodeUserOrgSelectorKey,
  encodeUserOrgSelectorKey,
  flattenUserOrgTreeNodes,
  limitUserOrgSelectorRecords,
  normalizeSelectorTypes,
} from '../user-org-selector-utils';

describe('user-org-selector-utils', () => {
  it('exposes a mockable org tree loader contract for public component demos', async () => {
    const loadOrgTree: UserOrgSelectorLoadOrgTree = async ({
      mode,
      orgTypes,
    }) => [
      {
        id: `${mode}-${orgTypes.join('-') || 'all'}`,
        name: '测试组织',
      },
    ];

    await expect(
      loadOrgTree({
        allowSelectOrg: true,
        allowSelectUser: true,
        depth: 1,
        maxLoadDeep: 0,
        mode: 'both',
        onlyLeafNode: false,
        onlyNotLeafNode: false,
        onlyShowTypeMatchNode: false,
        orgLoadMode: 'all',
        orgRootIds: [],
        orgTypes: ['Dept'],
        rootOrgIdList: [],
      }),
    ).resolves.toEqual([
      {
        id: 'both-Dept',
        name: '测试组织',
      },
    ]);
  });

  it('keeps type-mismatched org nodes visible but disabled by default', () => {
    const tree = buildUserOrgSelectorOrgTree(
      [
        {
          id: 'root',
          name: 'Root',
          type: 'Company',
          children: [
            {
              id: 'dept',
              name: 'Dept',
              type: 'Department',
            },
          ],
        },
        {
          id: 'other',
          name: 'Other',
          type: 'Company',
        },
      ],
      {
        mode: 'org',
        orgTypes: ['Department'],
      },
    );

    expect(tree).toHaveLength(2);
    expect(tree[0]?.id).toBe('root');
    expect(tree[0]?.disabled).toBe(true);
    expect(tree[0]?.children?.[0]?.id).toBe('dept');
    expect(tree[0]?.children?.[0]?.disabled).toBe(false);
    expect(tree[1]?.id).toBe('other');
    expect(tree[1]?.disabled).toBe(true);
  });

  it('only shows type-matched nodes when onlyShowTypeMatchNode is enabled', () => {
    const tree = buildUserOrgSelectorOrgTree(
      [
        {
          id: 'root',
          name: 'Root',
          orgType: 'Company',
          children: [
            {
              id: 'dept',
              name: 'Dept',
              orgType: 'Department',
            },
          ],
        },
        {
          id: 'other',
          name: 'Other',
          orgType: 'Company',
        },
      ],
      {
        mode: 'org',
        onlyShowTypeMatchNode: true,
        orgTypes: ['Department'],
      },
    );

    expect(tree.map((item) => item.id)).toEqual(['dept']);
    expect(tree[0]?.disabled).toBe(false);
  });

  it('applies leaf and non-leaf organization selection constraints', () => {
    const leafOnlyTree = buildUserOrgSelectorOrgTree(
      [
        {
          id: 'root',
          name: 'Root',
          children: [{ id: 'leaf', name: 'Leaf' }],
        },
      ],
      {
        mode: 'org',
        onlyLeafNode: true,
        orgTypes: [],
      },
    );

    expect(leafOnlyTree[0]?.disabled).toBe(true);
    expect(leafOnlyTree[0]?.children?.[0]?.disabled).toBe(false);

    const nonLeafOnlyTree = buildUserOrgSelectorOrgTree(
      [
        {
          id: 'root',
          name: 'Root',
          children: [{ id: 'leaf', name: 'Leaf' }],
        },
      ],
      {
        mode: 'org',
        onlyNotLeafNode: true,
        orgTypes: [],
      },
    );

    expect(nonLeafOnlyTree[0]?.disabled).toBe(false);
    expect(nonLeafOnlyTree[0]?.children?.[0]?.disabled).toBe(true);
  });

  it('limits built organization depth without treating unloaded nodes as selectable leaf nodes', () => {
    const tree = buildUserOrgSelectorOrgTree(
      [
        {
          id: 'root',
          name: 'Root',
          hasChildren: true,
          children: [
            {
              id: 'child',
              name: 'Child',
              hasChildren: true,
              children: [{ id: 'grandchild', name: 'Grandchild' }],
            },
          ],
        },
      ],
      {
        maxLoadDeep: 1,
        mode: 'org',
        onlyLeafNode: true,
        orgTypes: [],
      },
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children).toEqual([]);
    expect(tree[0]?.disabled).toBe(true);
  });

  it('keeps lazy org nodes expandable before the component has attempted loading', () => {
    const tree = buildUserOrgSelectorOrgTree(
      [
        {
          id: 'root',
          name: 'Root',
        },
      ],
      {
        allowSelectOrg: true,
        allowSelectUser: false,
        mode: 'org',
        orgLoadMode: 'lazy',
        orgTypes: [],
      },
    );

    expect(tree[0]?.hasChildren).toBe(false);
    expect(tree[0]?.isLeaf).toBe(false);
    expect(tree[0]?.loadAttempted).toBe(false);
    expect(tree[0]?.disabled).toBe(false);
  });

  it('does not allow unknown lazy nodes as leaf-only selections before loading is attempted', () => {
    const tree = buildUserOrgSelectorOrgTree(
      [
        {
          id: 'root',
          name: 'Root',
        },
      ],
      {
        allowSelectOrg: true,
        allowSelectUser: false,
        mode: 'org',
        onlyLeafNode: true,
        orgLoadMode: 'lazy',
        orgTypes: [],
      },
    );

    expect(tree[0]?.isLeaf).toBe(false);
    expect(tree[0]?.disabled).toBe(true);
  });

  it('marks matching org nodes as user-loadable in user mode', () => {
    const tree = buildUserOrgSelectorOrgTree(
      [
        {
          id: 'dept',
          name: 'Dept',
          type: 'Department',
        },
      ],
      {
        mode: 'user',
        orgTypes: ['Department'],
      },
    );

    expect(tree[0]?.disabled).toBe(true);
    expect(tree[0]?.canLoadUsers).toBe(true);
    expect(tree[0]?.isLeaf).toBe(false);
  });

  it('normalizes type filters and encodes tree keys', () => {
    expect(normalizeSelectorTypes(['', 'Department'])).toEqual(['Department']);

    const key = encodeUserOrgSelectorKey('user', 'a/b');
    expect(decodeUserOrgSelectorKey(key)).toEqual({
      id: 'a/b',
      kind: 'user',
    });
  });

  it('limits selector records using maxSelectCount semantics', () => {
    const records = [
      { id: 'org-1', kind: 'org' as const, name: 'Org 1' },
      { id: 'user-1', kind: 'user' as const, name: 'User 1' },
      { id: 'org-2', kind: 'org' as const, name: 'Org 2' },
    ];

    expect(limitUserOrgSelectorRecords(records, 0)).toEqual({
      limited: false,
      records,
    });
    expect(limitUserOrgSelectorRecords(records, 1)).toEqual({
      limited: true,
      records: [records[2]],
    });
    expect(limitUserOrgSelectorRecords(records, 2)).toEqual({
      limited: true,
      records: records.slice(0, 2),
    });
  });

  it('flattens nested tree nodes for lookup caches', () => {
    const tree = buildUserOrgSelectorOrgTree(
      [
        {
          id: 'root',
          name: 'Root',
          children: [{ id: 'dept', name: 'Dept' }],
        },
      ],
      {
        mode: 'both',
        orgTypes: [],
      },
    );

    expect(flattenUserOrgTreeNodes(tree).map((item) => item.id)).toEqual([
      'root',
      'dept',
    ]);
  });
});
