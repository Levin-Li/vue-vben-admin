import lucideCollection from '@iconify-json/lucide/icons.json';
import { addCollection } from '@iconify/vue';

addCollection(lucideCollection);

export * from './create-icon';

export * from './lucide';

export type { IconifyIcon as IconifyIconStructure } from '@iconify/vue';
export {
  addCollection,
  addIcon,
  Icon as IconifyIcon,
  listIcons,
} from '@iconify/vue';
