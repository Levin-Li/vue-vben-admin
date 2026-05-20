import { describe, expect, it } from 'vitest';

import {
  flattenSyncMenuItems,
  isSyncMenuRowIndeterminate,
  toEditableSyncMenuItems,
  toSelectedSyncMenuItems,
  toggleSyncMenuTreeKeys,
} from '../sync-menu-routes-state';

describe('sync-menu-routes-state', () => {
  const routes = toEditableSyncMenuItems([
    {
      children: [
        {
          children: [],
          label: '合同',
          moduleId: 'com.vma.fenz',
          path: '/cvf/V1/Contract',
        },
        {
          children: [],
          label: '合同文件',
          moduleId: 'com.vma.fenz',
          path: '/cvf/V1/ContractFile',
        },
      ],
      label: '合规账务系统',
      moduleId: 'com.vma.fenz',
      path: '/cvf/V1/index',
    },
  ]);

  it('cascades option checks from parent to descendants and marks partial parents indeterminate', () => {
    const [parent, firstChild, secondChild] = flattenSyncMenuItems(routes);

    let overrideKeys = toggleSyncMenuTreeKeys(
      routes,
      new Set<string>(),
      parent,
      true,
    );

    expect([...overrideKeys].sort()).toEqual(
      [parent.key, firstChild.key, secondChild.key].sort(),
    );

    overrideKeys = toggleSyncMenuTreeKeys(routes, overrideKeys, firstChild, false);

    expect(overrideKeys.has(parent.key)).toBe(false);
    expect(overrideKeys.has(firstChild.key)).toBe(false);
    expect(overrideKeys.has(secondChild.key)).toBe(true);
    expect(isSyncMenuRowIndeterminate(parent, overrideKeys)).toBe(true);
  });

  it('preserves necessary parents and serializes per-row upload options', () => {
    const [parent, child] = flattenSyncMenuItems(routes);
    const selectedKeys = new Set([child.key]);
    const enableKeys = new Set([parent.key, child.key]);
    const overrideKeys = new Set([child.key]);

    expect(
      toSelectedSyncMenuItems(routes, selectedKeys, {
        enable: enableKeys,
        overrideExisting: overrideKeys,
      }),
    ).toEqual([
      {
        children: [
          {
            children: [],
            enable: true,
            label: '合同',
            moduleId: 'com.vma.fenz',
            overrideExisting: true,
            path: '/cvf/V1/Contract',
          },
        ],
        enable: true,
        label: '合规账务系统',
        moduleId: 'com.vma.fenz',
        overrideExisting: false,
        path: '/cvf/V1/index',
      },
    ]);
  });
});
