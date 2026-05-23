import type { AdminFrontendModule } from '../../module-contract';

import { getBaseLocaleMessages } from '@vben/locales';

import { getEnabledFrontendModules } from '../options';

export function getApplicationI18nModules(
  adminFrameworkLocales: AdminFrontendModule['locales'],
): AdminFrontendModule[] {
  return [
    {
      locales: getBaseLocaleMessages(),
      name: '@vben/locales',
      order: -200,
      title: 'Vben 基础语言包',
    },
    {
      locales: adminFrameworkLocales,
      name: '@levin/admin-framework',
      order: -100,
      title: '管理框架语言包',
    },
    ...getEnabledFrontendModules(),
  ];
}
