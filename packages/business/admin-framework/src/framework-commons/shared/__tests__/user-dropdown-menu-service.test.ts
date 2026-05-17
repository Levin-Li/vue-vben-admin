import { defineComponent } from 'vue';

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addUserDropdownMenuItem,
  clearUserDropdownMenuItems,
  getUserDropdownMenuItems,
  removeUserDropdownMenuItem,
  useUserDropdownMenuItems,
} from '../user-dropdown-menu-service';

describe('user dropdown menu extension service', () => {
  beforeEach(() => {
    clearUserDropdownMenuItems();
  });

  it('adds, sorts, replaces and removes extension menu items', () => {
    const items = getUserDropdownMenuItems();
    const firstHandler = vi.fn();
    const replacementHandler = vi.fn();

    addUserDropdownMenuItem({
      handler: vi.fn(),
      id: 'later',
      order: 20,
      text: '稍后操作',
    });
    addUserDropdownMenuItem({
      handler: firstHandler,
      id: 'same',
      order: 10,
      text: '旧操作',
    });
    addUserDropdownMenuItem({
      handler: replacementHandler,
      id: 'same',
      order: 5,
      text: '新操作',
    });

    expect(items.value.map((item) => item.id)).toEqual(['same', 'later']);
    expect(items.value[0]?.text).toBe('新操作');
    expect(items.value[0]?.handler).toBe(replacementHandler);

    removeUserDropdownMenuItem('same');

    expect(items.value.map((item) => item.id)).toEqual(['later']);
  });

  it('cleans component-scoped registrations on unmount', () => {
    const UserDropdownMenuRegistrar = defineComponent({
      name: 'UserDropdownMenuRegistrar',
      setup() {
        const userDropdownMenus = useUserDropdownMenuItems();

        userDropdownMenus.add({
          handler: vi.fn(),
          id: 'component-action',
          text: '组件操作',
        });

        return () => null;
      },
    });
    const wrapper = mount(UserDropdownMenuRegistrar);

    expect(getUserDropdownMenuItems().value.map((item) => item.id)).toEqual([
      'component-action',
    ]);

    wrapper.unmount();

    expect(getUserDropdownMenuItems().value).toEqual([]);
  });
});
