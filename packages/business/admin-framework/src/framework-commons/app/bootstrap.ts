import { createApp, watch, watchEffect } from 'vue';

import { registerAccessDirective } from '@vben/access';
import { registerLoadingDirective } from '@vben/common-ui/es/loading';
import { preferences } from '@vben/preferences';
import { initStores, useAccessStore } from '@vben/stores';
import '@vben/styles';
import '@vben/styles/antd';

import { setAdminFrameworkRuntime } from '@levin/admin-framework';
import { requestClient } from '@levin/admin-framework/framework-commons/app/api/request';
import {
  $t,
  setupI18n,
} from '@levin/admin-framework/framework-commons/app/locales';
import { getAdminApplicationServices } from '@levin/admin-framework/framework-commons/app/options';
import { useTitle } from '@vueuse/core';

import { loadAdministrativeAreaOverride } from '../shared/administrative-area-data';
import { initComponentAdapter } from './adapter/component';
import { initSetupVbenForm } from './adapter/form';
import App from './app.vue';
import { registerRbacPermissionDirective } from './directives/rbac-permission';
import { registerGlobalOrgSelectorRuntime } from './global-org-selector-runtime';
import { router } from './router';
import {
  loadTenantSiteAdminUiBaseSetting,
  registerTenantSiteAdminUiBaseSettingListener,
} from './tenant-site-admin-ui-base-setting';
import { useAuthBrand } from './views/_core/authentication/auth-brand';

import './styles/antd-message.css';

async function bootstrap(namespace: string) {
  setAdminFrameworkRuntime({
    ...getAdminApplicationServices(),
    requestClient,
  });

  // 初始化组件适配器
  await initComponentAdapter();

  // 初始化表单组件
  await initSetupVbenForm();

  // // 设置弹窗的默认配置
  // setDefaultModalProps({
  //   fullscreenButton: false,
  // });
  // // 设置抽屉的默认配置
  // setDefaultDrawerProps({
  //   zIndex: 1020,
  // });

  const app = createApp(App);

  // 注册v-loading指令
  registerLoadingDirective(app, {
    loading: 'loading', // 在这里可以自定义指令名称，也可以明确提供false表示不注册这个指令
    spinning: 'spinning',
  });

  // 国际化 i18n 配置
  await setupI18n(app);

  // 配置 pinia-tore
  await initStores(app, { namespace });
  let hasLoadedAdministrativeAreaOverride = false;
  watch(
    () => useAccessStore().accessToken,
    (accessToken) => {
      if (!accessToken) {
        hasLoadedAdministrativeAreaOverride = false;
        return;
      }
      if (!hasLoadedAdministrativeAreaOverride) {
        hasLoadedAdministrativeAreaOverride = true;
        void loadAdministrativeAreaOverride();
      }
    },
    { immediate: true },
  );

  // 安装权限指令
  registerAccessDirective(app);
  registerRbacPermissionDirective(app);
  registerTenantSiteAdminUiBaseSettingListener();
  registerGlobalOrgSelectorRuntime();
  void loadTenantSiteAdminUiBaseSetting();

  // 初始化 tippy
  const { initTippy } = await import('@vben/common-ui/es/tippy');
  initTippy(app);

  // 配置路由及路由守卫
  app.use(router);

  // 配置Motion插件
  const { MotionPlugin } = await import('@vben/plugins/motion');
  app.use(MotionPlugin);

  // 登录页使用站点标题，后台页面保持应用标题配置。
  const authBrand = useAuthBrand();
  watchEffect(() => {
    if (preferences.app.dynamicTitle) {
      const routeTitle = router.currentRoute.value.meta?.title;
      const isAuthPage = router.currentRoute.value.path.startsWith('/auth/');
      const siteTitle = isAuthPage
        ? authBrand.appName.value
        : preferences.app.name;
      const pageTitle = (routeTitle ? `${$t(routeTitle)} - ` : '') + siteTitle;
      useTitle(pageTitle);
    }
  });

  app.mount('#app');
}

export { bootstrap };
