import { reactive, watch } from 'vue';

import { addLayoutHeaderExtensionAreaItem } from '@vben/layouts/basic/header-extension-area';
import { useTabbarStore, useUserStore } from '@vben/stores';

import { resolveUiSettingRuntime } from './api/ui-setting-runtime';
import {
  onGlobalUserOrgContextChange,
  setCurrentGlobalOrgId,
} from './global-org-context-state';
import GlobalOrgSelector from './global-org-selector.vue';
import { router } from './router';

export const GLOBAL_ORG_SELECTOR_UI_SETTING_CODE = '全局组织选择器';

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
  setCurrentGlobalOrgId(undefined);
}

async function loadRuntimeSetting(userId: string) {
  const version = ++initializationVersion;
  runtimeState.loading = true;
  setCurrentGlobalOrgId(undefined);

  try {
    const setting = await resolveUiSettingRuntime(
      GLOBAL_ORG_SELECTOR_UI_SETTING_CODE,
      `global-org-selector:${userId}`,
    );
    const valueContent = setting?.valueContent;

    if (version !== initializationVersion) {
      return;
    }

    runtimeState.valueContent = isNonEmptyRecord(valueContent)
      ? valueContent
      : undefined;
    runtimeState.enabled = runtimeState.valueContent !== undefined;
  } catch (error) {
    if (version !== initializationVersion) {
      return;
    }

    console.warn('加载全局组织选择器配置失败', error);
    runtimeState.enabled = false;
    runtimeState.valueContent = undefined;
  } finally {
    if (version === initializationVersion) {
      runtimeState.loading = false;
    }
  }
}

export function registerGlobalOrgSelectorRuntime() {
  headerDisposer?.();
  headerDisposer = addLayoutHeaderExtensionAreaItem('center', {
    class: 'w-[min(34vw,360px)] min-w-[220px] shrink-0',
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
    { immediate: true },
  );

  stopOrgChangeListener?.();
  stopOrgChangeListener = onGlobalUserOrgContextChange(() => {
    void useTabbarStore().invalidateCachedRouteViews(router);
  });

  return () => {
    headerDisposer?.();
    headerDisposer = undefined;
    stopUserWatcher?.();
    stopUserWatcher = undefined;
    stopOrgChangeListener?.();
    stopOrgChangeListener = undefined;
    resetRuntimeState();
  };
}
