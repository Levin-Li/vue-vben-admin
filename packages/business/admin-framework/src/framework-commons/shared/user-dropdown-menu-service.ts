import type { Component } from 'vue';

import { computed, markRaw, onBeforeUnmount, reactive } from 'vue';

export interface UserDropdownMenuItem {
  disabled?: boolean;
  handler: () => void | Promise<void>;
  icon?: Component | Function | string;
  id?: string;
  order?: number;
  text: string;
}

export interface UserDropdownMenuRecord extends UserDropdownMenuItem {
  id: string;
}

const userDropdownMenuItems = reactive<UserDropdownMenuRecord[]>([]);

let seed = 0;

function sortItems(items: UserDropdownMenuRecord[]) {
  return items.toSorted(
    (left, right) => (left.order || 0) - (right.order || 0),
  );
}

export function getUserDropdownMenuItems() {
  return computed(() => sortItems(userDropdownMenuItems));
}

export function addUserDropdownMenuItem(item: UserDropdownMenuItem) {
  const id = item.id || `user-dropdown-menu-${++seed}`;
  removeUserDropdownMenuItem(id);

  userDropdownMenuItems.push({
    ...item,
    icon: typeof item.icon === 'object' ? markRaw(item.icon) : item.icon,
    id,
  });

  return () => removeUserDropdownMenuItem(id);
}

export function removeUserDropdownMenuItem(id: string) {
  const index = userDropdownMenuItems.findIndex((item) => item.id === id);
  if (index >= 0) {
    userDropdownMenuItems.splice(index, 1);
  }
}

export function clearUserDropdownMenuItems() {
  userDropdownMenuItems.splice(0);
}

export function useUserDropdownMenuItems() {
  const disposers: Array<() => void> = [];

  function add(item: UserDropdownMenuItem) {
    const dispose = addUserDropdownMenuItem(item);
    disposers.push(dispose);
    return dispose;
  }

  onBeforeUnmount(() => {
    for (const dispose of disposers.splice(0)) {
      dispose();
    }
  });

  return {
    add,
    clear: clearUserDropdownMenuItems,
    items: getUserDropdownMenuItems(),
    remove: removeUserDropdownMenuItem,
  };
}
