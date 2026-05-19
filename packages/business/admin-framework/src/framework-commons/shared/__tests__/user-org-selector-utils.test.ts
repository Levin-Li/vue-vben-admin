import { describe, expect, it } from 'vitest';

import type { UserOrgSelectorLoadOrgTree } from '../user-org-selector-types';

import {
  buildUserOrgSelectorOrgTree,
  decodeUserOrgSelectorKey,
  encodeUserOrgSelectorKey,
  flattenUserOrgTreeNodes,
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
        mode: 'both',
        orgRootIds: [],
        orgTypes: ['Dept'],
      }),
    ).resolves.toEqual([
      {
        id: 'both-Dept',
        name: '测试组织',
      },
    ]);
  });

  it('keeps ancestor org nodes visible but disabled when only descendants match', () => {
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

    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe('root');
    expect(tree[0]?.disabled).toBe(true);
    expect(tree[0]?.children?.[0]?.id).toBe('dept');
    expect(tree[0]?.children?.[0]?.disabled).toBe(false);
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
