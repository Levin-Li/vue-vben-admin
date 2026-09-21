import type { MenuRecordRaw } from '@vben/runtime/types';

export function shouldNavigateSelectedMenu(menu?: MenuRecordRaw) {
  return Boolean(menu && (menu.navigateOnClick || !menu.children?.length));
}
