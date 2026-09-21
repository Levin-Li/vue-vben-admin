import { reactive, watch } from 'vue';

import { addLayoutHeaderExtensionAreaItem } from '@vben/layouts/basic/header-extension-area';
import { useAccessStore, useTabbarStore, useUserStore } from '@vben/runtime/stores';

import { resolveUiSettingRuntime } from './api/ui-setting-runtime';
import { onGlobalDomainContextChange } from './global-domain-context-state';
import {
  onGlobalUserOrgContextChange,
  setGlobalUserOrgContextEnabled,
} from './global-org-context-state';
import GlobalOrgSelector from './global-org-selector.vue';
import { router } from './router';

export const GLOBAL_ORG_SELECTOR_UI_SETTING_CODE = '全局组织与用户选择器';

const runtimeState = reactive({
  enabled: false,
  loading: false,
  valueContent: undefined as Record<string, any> | undefined,
});

export const globalOrgSelectorRuntimeState = runtimeState;

let headerDisposer: (() => void) | undefined;
let stopUserWatcher: (() => void) | undefined;
let stopOrgChangeListener: (() => void) | undefined;
let initializationVersion = 0;
let contextRefreshVersion = 0;

async function refreshMenusAndActivePage() {
  const version = ++contextRefreshVersion;
  // 重新进入路由守卫以按最新 Header 拉取授权菜单，再重建活动页。
  useAccessStore().setIsAccessChecked(false);
  await router.replace(router.currentRoute.value.fullPath);
  if (version === contextRefreshVersion) {
    await useTabbarStore().invalidateCachedRouteViews(router);
  }
}

function isNonEmptyRecord(value: unknown): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function getUserIdentity() {
  const user = (useUserStore().userInfo || {}) as Record<string, any>;
  return String(user.userId || user.id || '').trim();
}

function resetRuntimeState() {
  initializationVersion += 1;
  runtimeState.enabled = false;
  runtimeState.loading = false;
  runtimeState.valueContent = undefined;
  setGlobalUserOrgContextEnabled(false);
}

async function loadRuntimeSetting(userId: string) {
  const version = ++initializationVersion;
  runtimeState.loading = true;
  runtimeState.enabled = false;
  runtimeState.valueContent = undefined;
  setGlobalUserOrgContextEnabled(false);

  try {
    const setting = await resolveUiSettingRuntime(
      GLOBAL_ORG_SELECTOR_UI_SETTING_CODE,
      `global-org-selector:${userId}`,
      { refresh: true },
    );
    const valueContent = setting?.valueContent;

    if (version !== initializationVersion) {
      return;
    }

    runtimeState.valueContent = isNonEmptyRecord(valueContent)
      ? valueContent
      : undefined;
    runtimeState.enabled = runtimeState.valueContent !== undefined;
    setGlobalUserOrgContextEnabled(runtimeState.enabled);
  } catch (error) {
    if (version !== initializationVersion) {
      return;
    }

    console.warn('加载全局组织与用户选择器配置失败', error);
    runtimeState.enabled = false;
    runtimeState.valueContent = undefined;
    setGlobalUserOrgContextEnabled(false);
  } finally {
    if (version === initializationVersion) {
      runtimeState.loading = false;
    }
  }
}

export function registerGlobalOrgSelectorRuntime() {
  headerDisposer?.();
  headerDisposer = addLayoutHeaderExtensionAreaItem('center', {
    class: 'max-w-[360px] shrink-0',
    component: GlobalOrgSelector,
    id: 'global-org-selector',
    order: 20,
  });

  stopUserWatcher?.();
  stopUserWatcher = watch(
    getUserIdentity,
    (userId) => {
      if (userId) {
        void loadRuntimeSetting(userId);
      } else {
        resetRuntimeState();
      }
    },
    // 身份变化时同步关闭旧范围，避免同一调用栈发出的请求带入上一账号组织。
    { flush: 'sync', immediate: true },
  );

  stopOrgChangeListener?.();
  stopOrgChangeListener = onGlobalUserOrgContextChange(() => {
    void refreshMenusAndActivePage();
  });

  const stopDomainChangeListener = onGlobalDomainContextChange(() => {
    void refreshMenusAndActivePage();
  });

  return () => {
    headerDisposer?.();
    headerDisposer = undefined;
    stopUserWatcher?.();
    stopUserWatcher = undefined;
    stopOrgChangeListener?.();
    stopOrgChangeListener = undefined;
    stopDomainChangeListener();
    resetRuntimeState();
  };
}
