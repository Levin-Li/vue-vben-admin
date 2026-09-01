import type { MenuRecordRaw } from '@vben/types';

export function shouldNavigateSelectedMenu(menu?: MenuRecordRaw) {
  return Boolean(menu && (menu.navigateOnClick || !menu.children?.length));
}
