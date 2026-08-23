import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  appendLayoutItem,
  appendLayoutItemsAtTarget,
  appendLayoutItemAtTarget,
  canDragLayoutItem,
  collectExpandedTreeKeys,
  collectLayoutPaths,
  filterTreeByLabel,
  findLayoutItem,
  flattenMenuSources,
  hasLayoutPathAtTarget,
  insertLayoutItemBeside,
  keepLayoutRootExpanded,
  moveLayoutItem,
  removeLayoutItem,
  toPersistedLayoutItems,
  toLayoutItem,
  updateLayoutItemValue,
} from '../layout-tree';

const adjusterSource = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/tenant-custom-menu/index.vue',
  'utf8',
);

function getAdjusterFunctionSource(name: string) {
  const start = adjusterSource.indexOf(`function ${name}`);
  if (start < 0) {
    return '';
  }

  const nextFunctionStarts = [
    adjusterSource.indexOf('\nfunction ', start + 1),
    adjusterSource.indexOf('\nasync function ', start + 1),
    adjusterSource.indexOf('\n</script>', start + 1),
  ].filter((index) => index >= 0);
  const end = Math.min(...nextFunctionStarts);
  return adjusterSource.slice(start, end);
}

describe('menu display layout tree', () => {
  it('keeps menu paths unique while allowing virtual groups', () => {
    const items = [
      {
        children: [{ key: 'menu:theater', label: '剧场号', path: '/theater' }],
        key: 'group:video',
        label: '视频号',
      },
    ];

    expect([...collectLayoutPaths(items)]).toEqual(['/theater']);
    expect(findLayoutItem(items, 'group:video')?.path).toBeUndefined();
  });

  it('moves items between layout groups without duplicating them', () => {
    const items = [
      { key: 'group:video', label: '视频号' },
      { key: 'menu:delivery', label: '投流号', path: '/delivery' },
    ];
    const moved = removeLayoutItem(items, 'menu:delivery');

    expect(moved).toBeDefined();
    expect(appendLayoutItem(items, 'group:video', moved!)).toBe(true);
    expect(findLayoutItem(items, 'menu:delivery')?.path).toBe('/delivery');
  });

  it('keeps sibling order when moving a layout item beside another item', () => {
    const items = [
      { key: 'menu:theater', label: '剧场号', path: '/theater' },
      { key: 'menu:delivery', label: '投流号', path: '/delivery' },
    ];
    const moved = removeLayoutItem(items, 'menu:delivery');

    expect(insertLayoutItemBeside(items, 'menu:theater', moved!, false)).toBe(
      true,
    );
    expect(items.map((item) => item.key)).toEqual([
      'menu:delivery',
      'menu:theater',
    ]);
  });

  it('creates a menu item from the real menu route and display title', () => {
    expect(
      toLayoutItem({
        enable: false,
        label: '剧场号',
        path: '/clob/V1/Theater',
      }),
    ).toEqual({
      enable: false,
      key: 'menu:/clob/V1/Theater',
      label: '剧场号',
      path: '/clob/V1/Theater',
    });
  });

  it('keeps the dragged tree title and route when source fields are normalized by the tree', () => {
    expect(
      toLayoutItem({
        path: '/system/import-export-template',
        title: '导入导出模板',
      }),
    ).toEqual({
      enable: true,
      key: 'menu:/system/import-export-template',
      label: '导入导出模板',
      path: '/system/import-export-template',
    });
  });

  it('removes editor-only keys before persisting the layout', () => {
    expect(
      toPersistedLayoutItems([
        {
          children: [
            { key: 'menu:theater', label: '剧场号', path: '/theater' },
          ],
          key: 'group:video',
          label: '视频号',
        },
      ]),
    ).toEqual([
      {
        children: [{ label: '剧场号', path: '/theater' }],
        label: '视频号',
      },
    ]);
  });

  it('persists disabled display items as enable false', () => {
    expect(
      toPersistedLayoutItems([
        { enable: false, key: 'menu:theater', label: '剧场号', path: '/theater' },
      ]),
    ).toEqual([{ enable: false, label: '剧场号', path: '/theater' }]);
  });

  it('ignores malformed child collections while flattening source menus', () => {
    expect(
      flattenMenuSources([
        { children: {} as any, label: '后台管理' },
      ]),
    ).toEqual([{ children: {}, label: '后台管理' }]);
  });

  it('filters by name, label, or path while preserving matching ancestors and their expand keys', () => {
    const items = [
      {
        children: [
          {
            key: 'menu:reports',
            label: '报表中心',
            name: 'report-center',
            path: '/report/center',
          },
          { key: 'menu:settings', label: '系统设置' },
        ],
        key: 'group:system',
        label: '后台管理',
      },
    ];

    const searchableText = (item: (typeof items)[number] | (typeof items)[number]['children'][number]) =>
      [item.name, item.label, item.path].filter(Boolean).join(' ');
    const filtered = filterTreeByLabel(items, 'report-center', searchableText);

    expect(filtered).toEqual([
      {
        children: [
          {
            children: [],
            key: 'menu:reports',
            label: '报表中心',
            name: 'report-center',
            path: '/report/center',
          },
        ],
        key: 'group:system',
        label: '后台管理',
      },
    ]);
    expect(collectExpandedTreeKeys(filtered)).toEqual(['group:system']);
    expect(
      filterTreeByLabel(items, '/report/center', searchableText),
    ).toHaveLength(1);
  });

  it('keeps the virtual menu-list root expanded while preserving child state', () => {
    expect(keepLayoutRootExpanded(['group:reports'], 'root:my-menu')).toEqual([
      'root:my-menu',
      'group:reports',
    ]);
    expect(keepLayoutRootExpanded([], 'root:my-menu')).toEqual([
      'root:my-menu',
    ]);
  });

  it('adds a dropped menu to the virtual root or the matching target node', () => {
    const rootItems = [{ key: 'group:reports', label: '报表' }];
    const rootMenu = { key: 'menu:home', label: '首页', path: '/home' };
    const childMenu = { key: 'menu:daily', label: '日报', path: '/daily' };

    expect(
      appendLayoutItemAtTarget(
        rootItems,
        'root:my-menu',
        'root:my-menu',
        rootMenu,
      ),
    ).toBe(true);
    expect(
      appendLayoutItemAtTarget(
        rootItems,
        'root:my-menu',
        'group:reports',
        childMenu,
      ),
    ).toBe(true);
    expect(rootItems).toEqual([
      {
        children: [childMenu],
        key: 'group:reports',
        label: '报表',
      },
      rootMenu,
    ]);
  });

  it('allows the same menu path under different targets but not the same target', () => {
    const items = [
      {
        children: [
          { key: 'menu:group-a:report', label: '报表', path: '/report' },
        ],
        key: 'group:a',
        label: '分组 A',
      },
      { key: 'group:b', label: '分组 B' },
    ];

    expect(
      hasLayoutPathAtTarget(items, 'root:my-menu', 'group:a', '/report'),
    ).toBe(true);
    expect(
      hasLayoutPathAtTarget(items, 'root:my-menu', 'group:b', '/report'),
    ).toBe(false);
    expect(
      hasLayoutPathAtTarget(items, 'root:my-menu', 'root:my-menu', '/report'),
    ).toBe(false);
  });

  it('adds non-duplicate menu items in a batch while skipping duplicates at the same target', () => {
    const items = [
      {
        children: [
          { key: 'menu:group:report', label: '报表', path: '/report' },
        ],
        key: 'group:reports',
        label: '报表分组',
      },
    ];

    expect(
      appendLayoutItemsAtTarget(items, 'root:my-menu', 'group:reports', [
        { key: 'menu:group:report-copy', label: '报表副本', path: '/report' },
        { key: 'menu:group:daily', label: '日报', path: '/daily' },
      ]),
    ).toEqual({ added: 1, skipped: 1 });
    expect(items[0]?.children?.map((item) => item.path)).toEqual([
      '/report',
      '/daily',
    ]);
  });

  it('clears source-menu checks after a successful batch add', () => {
    expect(getAdjusterFunctionSource('addMenusToSelectedTarget')).toMatch(
      /if \(added\) \{\s+layoutItems\.value = cloneLayoutItems\(layoutItems\.value\);[\s\S]*?clearSourceMenuChecks\(\);/,
    );
  });

  it('refreshes the CRUD list and advances the local optimistic lock after saving a layout', () => {
    const saveLayoutSource = getAdjusterFunctionSource('saveLayout');

    expect(saveLayoutSource).toContain(
      'layout.optimisticLock = (layout.optimisticLock ?? 0) + 1;',
    );
    expect(saveLayoutSource).toContain('await layoutListReload.value?.();');
    expect(adjusterSource).toContain('<template #row-actions="{ record, reload }">');
    expect(adjusterSource).toContain('@click="openLayoutAdjuster(record, reload)"');
  });

  it('switches the source-menu action between select-all and clear-selected', () => {
    expect(adjusterSource).toContain('function clearSourceMenuChecks()');
    expect(adjusterSource).toContain('function toggleAllSourceMenuChecks()');
    expect(adjusterSource).toMatch(
      /系统菜单[\s\S]*?@click="toggleAllSourceMenuChecks"[\s\S]*?hasSelectedSourceMenus \? '清空选中' : '全部选中'/,
    );
  });

  it('toggles source-menu checks from the node content with parent-child cascade', () => {
    expect(adjusterSource).toContain('function toggleSourceMenuCheck');
    expect(adjusterSource).toContain('function syncSourceAncestorChecks');
    expect(adjusterSource).toContain('const subtreeKeys = flattenMenuSources([source])');
    expect(adjusterSource).toContain('syncSourceAncestorChecks(sourceTreeData.value, checkedKeys);');
    expect(adjusterSource).toContain('@click="toggleSourceMenuCheck(dataRef)"');
    expect(adjusterSource).toContain('@click.stop="addMenu(dataRef)"');
  });

  it('toggles layout-menu checks from node content without changing the current target selection', () => {
    expect(adjusterSource).toContain('function toggleLayoutItemCheck');
    expect(adjusterSource).toContain('function syncLayoutAncestorChecks');
    expect(adjusterSource).toContain('function collectLayoutItemKeys');
    expect(adjusterSource).toContain('syncLayoutAncestorChecks(layoutItems.value, checkedKeys);');
    expect(adjusterSource).toContain('@click.stop="toggleLayoutItemCheck(dataRef)"');
    expect(getAdjusterFunctionSource('toggleLayoutItemCheck')).not.toMatch(
      /selectedItemKey\.value\s*=/,
    );
  });

  it('updates the persisted enable state through the real layout item key', () => {
    const items = [
      {
        children: [
          { enable: true, key: 'menu:daily', label: '日报', path: '/daily' },
        ],
        key: 'group:reports',
        label: '报表',
      },
    ];

    expect(updateLayoutItemValue(items, 'menu:daily', 'enable', false)).toBe(
      true,
    );
    expect(toPersistedLayoutItems(items)).toEqual([
      {
        children: [{ enable: false, label: '日报', path: '/daily' }],
        label: '报表',
      },
    ]);
  });

  it('moves a layout node only within its siblings', () => {
    const items = [
      { key: 'menu:home', label: '首页', path: '/home' },
      {
        children: [
          { key: 'menu:daily', label: '日报', path: '/daily' },
          { key: 'menu:weekly', label: '周报', path: '/weekly' },
        ],
        key: 'group:reports',
        label: '报表',
      },
      { key: 'menu:settings', label: '设置', path: '/settings' },
    ];

    expect(moveLayoutItem(items, 'menu:settings', 'up')).toBe(true);
    expect(moveLayoutItem(items, 'menu:weekly', 'up')).toBe(true);
    expect(items.map((item) => item.key)).toEqual([
      'menu:home',
      'menu:settings',
      'group:reports',
    ]);
    expect(items[2]?.children?.map((item) => item.key)).toEqual([
      'menu:weekly',
      'menu:daily',
    ]);
    expect(moveLayoutItem(items, 'menu:home', 'up')).toBe(false);
  });

  it('keeps the route in a hover tooltip instead of permanently rendering it', () => {
    expect(adjusterSource).toMatch(
      /<Tooltip :title="getLayoutTreeItem\(dataRef\)\.path \|\| undefined">/,
    );
    expect(adjusterSource).not.toContain('{{ getLayoutTreeItem(dataRef).path }}');
  });

  it('allows dragging layout items but not the virtual root', () => {
    expect(canDragLayoutItem('menu:daily', 'root:my-menu')).toBe(true);
    expect(canDragLayoutItem('root:my-menu', 'root:my-menu')).toBe(false);
  });

  it('requires confirmation before removing a layout node', () => {
    expect(adjusterSource).toMatch(
      /<Popconfirm\s+title="确认删除当前菜单及其子菜单？"\s+@confirm="removeLayoutItemByKey\(dataRef\.key\)"[\s\S]*?@open-change/,
    );
  });

  it('keeps the delete action mounted while its confirmation is open', () => {
    expect(adjusterSource).toContain('const deleteConfirmKey = ref<string>();');
    expect(adjusterSource).toContain('function handleDeleteConfirmOpenChange');
    expect(adjusterSource).toContain('deleteConfirmKey === dataRef.key');
    expect(adjusterSource).toContain(
      'handleDeleteConfirmOpenChange(dataRef.key, open)',
    );
  });

  it('uses menu terminology for child-menu create and delete operations', () => {
    expect(adjusterSource).toContain('<Tooltip title="删除菜单">');
    expect(adjusterSource).toContain('<Tooltip title="新增子菜单">');
    expect(adjusterSource).not.toContain('<Tooltip title="删除节点">');
    expect(adjusterSource).not.toContain('<Tooltip title="新增子节点">');
  });

  it('exposes a hover-only drag handle for editable source-menu nodes', () => {
    expect(adjusterSource).toContain('group-hover:opacity-100');
    expect(adjusterSource).toContain('cursor-grab active:cursor-grabbing');
  });

  it('keeps source-menu rows stable when the hover transfer action appears', () => {
    expect(adjusterSource).toContain(
      'group relative flex h-9 w-full min-w-0 items-center gap-2 py-1 pr-9',
    );
    expect(adjusterSource).toContain('block min-w-0 flex-1 truncate');
    expect(adjusterSource).toContain(
      'absolute right-1 top-1/2 hidden !size-7 shrink-0 -translate-y-1/2',
    );
  });

  it('places the layout drag handle next to the label field instead of before tree indentation', () => {
    expect(adjusterSource).toContain('icon: false');
    expect(adjusterSource).toMatch(
      /v-if="isAdjusting"\s+class="text-muted-foreground size-3\.5 shrink-0 cursor-grab active:cursor-grabbing"\s+icon="lucide:grip-vertical"/,
    );
  });

  it('uses the layout drag handle for both reordering and moving into another node', () => {
    expect(adjusterSource).toContain('const draggedLayoutKey = ref<string>();');
    expect(adjusterSource).toContain('@dragstart="handleLayoutDragStart"');
    expect(adjusterSource).not.toContain('@dragstart="beginLayoutItemDrag(dataRef.key)"');
    expect(adjusterSource).toContain('@drop="handleLayoutDrop"');
    expect(adjusterSource).toContain("const movedAsChild = dropMode ? dropMode === 'child' : !info.dropToGap;");
    expect(adjusterSource).toContain('insertLayoutItemBeside(');
  });

  it('highlights an internal drop target and its add-child action with the theme color', () => {
    expect(adjusterSource).toContain('function isActiveLayoutDropTarget');
    expect(adjusterSource).not.toContain("'!border-primary': isActiveLayoutDropTarget");
    expect(adjusterSource).not.toContain('bg-primary/5');
    expect(adjusterSource).toContain("? '!border-primary text-primary'");
    expect(adjusterSource).not.toContain('松开后作为该节点的子菜单加入');
    expect(adjusterSource).toMatch(
      /hoveredLayoutKey === dataRef\.key \|\|[\s\S]*?isActiveLayoutDropTarget\(dataRef\.key, 'child'\)/,
    );
  });

  it('visually distinguishes adding a child menu from sorting beside a menu', () => {
    expect(adjusterSource).toContain(
      "type LayoutDropMode = 'after' | 'before' | 'child';",
    );
    expect(adjusterSource).toContain('const dropTargetMode = ref<LayoutDropMode>();');
    expect(adjusterSource).toContain('function updateLayoutDropTargetFromPointer');
    expect(adjusterSource).toContain("isActiveLayoutDropTarget(dataRef.key, 'before')");
    expect(adjusterSource).toContain("isActiveLayoutDropTarget(dataRef.key, 'after')");
    expect(adjusterSource).toContain('absolute -top-1 left-0 right-0');
    expect(adjusterSource).toContain('absolute -bottom-1 left-0 right-0');
    expect(adjusterSource).toContain("isActiveLayoutDropTarget(dataRef.key, 'child')");
  });

  it('uses the pointer position for drop mode and inserts before the first root menu', () => {
    expect(adjusterSource).toContain('function getLayoutDropModeFromPointer');
    expect(adjusterSource).toContain("pointerTarget?.closest('.layout-menu-label-drop-zone')");
    expect(adjusterSource).toContain("return relativeY < rect.height / 2 ? 'before' : 'after';");
    expect(adjusterSource).toContain('class="layout-menu-label-drop-zone relative min-w-28 flex-1"');
    expect(adjusterSource).toContain('class="layout-menu-label-input w-full"');
    expect(adjusterSource).toContain('updateLayoutDropTargetFromPointer(event, dataRef.key)');
    expect(getAdjusterFunctionSource('handleLayoutDrop')).toContain(
      'next.unshift(moved)',
    );
  });

  it('applies the same pointer-derived child-or-sort mode when dragging from system menus', () => {
    expect(getAdjusterFunctionSource('getLayoutDropModeFromPointer')).not.toContain(
      'draggedSource.value ||',
    );
    expect(adjusterSource).toContain('function findLayoutParentKey');
    expect(getAdjusterFunctionSource('appendSourceAtTarget')).toContain(
      "dropMode: LayoutDropMode = 'child'",
    );
    expect(getAdjusterFunctionSource('handleLayoutSourceDrop')).toContain(
      'appendSourceAtTarget(source, targetKey, dropMode);',
    );
  });

  it('shows the add-child-menu action only for child-menu drop targets, not sort targets', () => {
    expect(adjusterSource).toContain('function shouldShowAddChildMenuAction');
    expect(getAdjusterFunctionSource('shouldShowAddChildMenuAction')).toContain(
      'return !draggedSource.value && !draggedLayoutKey.value;',
    );
    expect(adjusterSource).toContain(
      'v-if="shouldShowAddChildMenuAction(dataRef.key)"',
    );
    expect(adjusterSource).toContain('function setLayoutDropEffect');
    expect(adjusterSource).toContain("mode === 'child' ? 'copy' : 'move'");
    expect(adjusterSource).not.toContain('rounded-full bg-success text-white');
    expect(adjusterSource).not.toContain('inputDropTargetKey');
    expect(adjusterSource).not.toContain('handleLayoutInputDragOver');
  });

  it('lets tree drag-enter identify the source without overriding pointer-derived drop mode', () => {
    const source = getAdjusterFunctionSource('handleLayoutDragEnter');
    expect(source).not.toContain('setLayoutDropTarget');
    expect(getAdjusterFunctionSource('beginLayoutItemDrag')).toContain(
      'const isSameDraggedLayoutItem',
    );
  });

  it('derives the internal drag source from tree drag events before highlighting a target', () => {
    expect(getAdjusterFunctionSource('handleLayoutDragEnter')).toMatch(
      /if \(!draggedSource\.value\) \{\s+beginLayoutItemDrag\(getTreeNodeKey\(info\.dragNode\)\);/,
    );
    expect(adjusterSource).toContain('function getTreeNodeKey(node: any)');
    expect(adjusterSource).toContain('node?.key ?? node?.eventKey');
  });

  it('supports checked layout items for clear-or-delete batch actions without checking the virtual root', () => {
    expect(adjusterSource).toContain('const checkedLayoutKeys = ref<string[]>([]);');
    expect(adjusterSource).toContain('const hasCheckedLayoutItems = computed(');
    expect(adjusterSource).toContain('disableCheckbox: true');
    expect(adjusterSource).toMatch(
      /<Tree\s+v-else\s+checkable[\s\S]*?:checked-keys="checkedLayoutKeys"/,
    );
    expect(adjusterSource).toContain('@check="handleLayoutCheck"');
    expect(adjusterSource).toContain('function clearLayoutItemChecks()');
    expect(adjusterSource).toContain('function removeCheckedLayoutItems()');
    expect(adjusterSource).toContain("title: '确认删除选中的菜单？'");
  });

  it('switches the layout-menu action between select-all and clear-selected', () => {
    expect(adjusterSource).toContain('function toggleAllLayoutItemChecks()');
    expect(adjusterSource).toMatch(
      /我的菜单[\s\S]*?@click="toggleAllLayoutItemChecks"[\s\S]*?hasCheckedLayoutItems \? '清空选中' : '全部选中'/,
    );
    expect(adjusterSource.match(/:disabled="!hasCheckedLayoutItems"/g)).toHaveLength(1);
  });

  it('reveals the one-click transfer action on source-node hover and delegates missing-target feedback to the click handler', () => {
    expect(adjusterSource).not.toContain(
      'const hasSelectedLayoutTarget = computed(',
    );
    expect(adjusterSource).toContain(
      'sourceAddActionHoverKey === dataRef.key',
    );
    expect(adjusterSource).toMatch(
      /<Tooltip title="点击添加到右侧选中的节点">[\s\S]*?@click\.stop="addMenu\(dataRef\)"/,
    );
    expect(adjusterSource).toMatch(
      /hidden[^"\n]*group-hover:inline-flex/,
    );
    expect(adjusterSource).toContain(
      '!size-7 shrink-0 -translate-y-1/2 items-center justify-center !p-0',
    );
    expect(adjusterSource).toContain('sourceAddActionHoverKey');
    expect(adjusterSource).toContain(
      '点击添加到右侧选中的节点',
    );
    expect(adjusterSource).toContain('请先在我的菜单中选择目标节点');
  });

  it('selects the permanent virtual root when opening the layout adjuster', () => {
    expect(adjusterSource).toMatch(
      /async function openLayoutAdjuster[\s\S]*?selectedItemKey\.value = MY_MENU_ROOT_KEY/,
    );
  });

  it('keeps selection unchanged while expanding parents after children are added', () => {
    for (const name of [
      'addChildLayoutItem',
      'addGroup',
      'addMenu',
      'appendSourceAtTarget',
      'handleLayoutDrop',
    ]) {
      expect(getAdjusterFunctionSource(name)).not.toMatch(
        /selectedItemKey\.value\s*=/,
      );
    }
    expect(adjusterSource).toContain('function expandLayoutParent');
    for (const name of [
      'addChildLayoutItem',
      'addGroup',
      'addMenusToSelectedTarget',
      'appendSourceAtTarget',
    ]) {
      expect(getAdjusterFunctionSource(name)).toContain('expandLayoutParent');
    }
    expect(getAdjusterFunctionSource('handleLayoutDrop')).toMatch(
      /if \(movedAsChild\) \{\s+expandLayoutParent\(targetKey\);/,
    );
  });
});
