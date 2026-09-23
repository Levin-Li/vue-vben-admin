import { createApp, watch, watchEffect } from 'vue';

import { registerLoadingDirective } from '@vben/common-ui/es/loading';
import { registerAccessDirective } from '@vben/runtime/access';
import { initStores, useAccessStore, useUserStore } from '@vben/runtime/stores';
import '@vben/runtime/styles';
import '@vben/runtime/styles/antd';

import { preferences } from '@vben-core/foundation/preferences';

import { setAdminFrameworkRuntime } from '@levin/admin-framework';
import { requestClient } from '@levin/admin-framework/framework-commons/app/api/request';
import {
  $t,
  setupI18n,
} from '@levin/admin-framework/framework-commons/app/locales';
import {
  getAdminApplicationServices,
  getEnabledFrontendModules,
} from '@levin/admin-framework/framework-commons/app/options';
import { useTitle } from '@vueuse/core';

import { setupAdminModules } from '../module-contract';
import { loadAdministrativeAreaOverride } from '../shared/administrative-area-data';
import { initComponentAdapter } from './adapter/component';
import { initSetupVbenForm } from './adapter/form';
import { createAdminUiPreferencesStartupLoader } from './admin-ui-preferences-startup';
import App from './app.vue';
import { registerRbacPermissionDirective } from './directives/rbac-permission';
import { registerGlobalOrgSelectorRuntime } from './global-org-selector-runtime';
import { router } from './router';
import { resetAccessStateForApplicationStart } from './store/user-access-session';
import { registerTenantSiteAdminUiBaseSettingListener } from './tenant-site-admin-ui-base-setting';
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
  const pinia = await initStores(app, { namespace });
  // 菜单只信任本次启动从服务端获得的结果；未能加载时由路由守卫保持会话但清空菜单。
  resetAccessStateForApplicationStart(useAccessStore(pinia));
  const adminUiPreferencesStartupLoader =
    createAdminUiPreferencesStartupLoader();
  // 启动期并行获取服务端偏好，后续初始化继续执行；挂载前最多等待三秒。
  const adminUiPreferencesReady =
    adminUiPreferencesStartupLoader.prepareForMount();
  let hasLoadedAdministrativeAreaOverride = false;
  watch(
    () => useAccessStore().accessToken,
    (accessToken, previousAccessToken) => {
      if (!accessToken) {
        hasLoadedAdministrativeAreaOverride = false;
        return;
      }
      if (!hasLoadedAdministrativeAreaOverride) {
        hasLoadedAdministrativeAreaOverride = true;
        void loadAdministrativeAreaOverride();
      }
      // 登录成功后重新从独立 UI 设置记录加载界面偏好。
      adminUiPreferencesStartupLoader.onAccessTokenChanged(
        accessToken,
        previousAccessToken,
      );
    },
    { immediate: true },
  );

  // 安装权限指令
  registerAccessDirective(app);
  registerRbacPermissionDirective(app);
  registerTenantSiteAdminUiBaseSettingListener();
  registerGlobalOrgSelectorRuntime();

  // 初始化 tippy
  const { initTippy } = await import('@vben/common-ui/es/tippy');
  initTippy(app);

  // 配置路由及路由守卫
  app.use(router);

  // 模块可在 setup 中注册应用级扩展；必须在挂载前统一执行，避免模块声明只被收集而未生效。
  await setupAdminModules(getEnabledFrontendModules(), {
    app,
    getUser: () => useUserStore().userInfo || null,
    pinia,
    request: requestClient,
    router,
  });

  // 配置Motion插件
  const { MotionPlugin } = await import('@vben/runtime/plugins/motion');
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

  // 首屏最多等待三秒使用服务端偏好，超时后的结果由加载器在后台补应用。
  await adminUiPreferencesReady;
  app.mount('#app');
  // 应用挂载后允许登录令牌变化触发用户范围的重新解析。
  adminUiPreferencesStartupLoader.onApplicationMounted();
}

export { bootstrap };
