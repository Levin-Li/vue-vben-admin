import { defineAdminModuleLocales } from '@levin/admin-framework';

export const oakBaseAdminLocales = defineAdminModuleLocales(
  import.meta.glob('./locales/**/*.json', { eager: true }),
);
