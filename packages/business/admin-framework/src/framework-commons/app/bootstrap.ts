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

import { isDataAttrPolicyReady } from '../data-attr-policy';
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
import {
  captureBindCallbackBeforeStartup,
  stripBindCallbackQuery,
} from './views/_core/profile/oauth-bind-callback';

import './styles/antd-message.css';

async function bootstrap(namespace: string) {
  // 任何站点/用户初始化请求前清掉短期授权码，随后由已认证的个人中心一次性恢复。
  const capturedBindCallback = captureBindCallbackBeforeStartup();
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
    // 令牌签发时本人信息和权限尚未齐备，必须等待正式授权初始化完成。
    () => (isDataAttrPolicyReady() ? useAccessStore().accessToken : null),
    (accessToken, previousAccessToken) => {
      // 暂停会话时先废弃旧身份的偏好响应，避免退出后迟到回写。
      adminUiPreferencesStartupLoader.onAccessTokenChanged(
        accessToken || undefined,
        previousAccessToken || undefined,
      );
      if (!accessToken) {
        hasLoadedAdministrativeAreaOverride = false;
        return;
      }
      if (!hasLoadedAdministrativeAreaOverride) {
        hasLoadedAdministrativeAreaOverride = true;
        void loadAdministrativeAreaOverride().catch((error) => {
          console.warn('加载行政区划覆盖配置失败，继续使用内置数据', error);
        });
      }
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

  // 模块可在 setup 中注册应用级扩展；必须在挂载前统一执行，避免模块声明只被收集而未生效。
  await setupAdminModules(getEnabledFrontendModules(), {
    app,
    getUser: () => useUserStore().userInfo || null,
    pinia,
    request: requestClient,
    router,
  });

  // 模块共享目录注册完成后再启动首个路由守卫和会话初始化。
  app.use(router);

  // 路由可能缓存清理前的首个 URL；绑定恢复时等待稳定后同步剔除，保留业务路径和片段。
  if (capturedBindCallback) {
    await router.isReady();
    const route = router.currentRoute.value;
    await router.replace({
      path: route.path,
      query: stripBindCallbackQuery(route.query),
      hash: route.hash,
    });
  }

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
