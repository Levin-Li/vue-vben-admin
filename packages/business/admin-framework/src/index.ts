import { defineAsyncComponent } from 'vue';

export * from './framework-commons/api';
export * from './framework-commons/api-authorize';
export * from './framework-commons/app/options';
export * from './framework-commons/event-bus';
export * from './framework-commons/locale-utils';
export * from './framework-commons/module-contract';
export * from './framework-commons/page-map';
export * from './framework-commons/page-registry';
export { default as RbacPermissionMatchUtils } from './framework-commons/rbac-permission-match';
export * from './framework-commons/request-service';
export * from './framework-commons/runtime';
export * from './framework-commons/shared/draggable-floating-panel-service';
export * from './framework-commons/shared/user-dropdown-menu-service';
export * from './framework-commons/shared/user-org-selector-types';

export {
  addLayoutHeaderExtensionAreaItem,
  clearLayoutHeaderExtensionArea,
  getLayoutHeaderExtensionAreaItems,
  type LayoutHeaderExtensionAreaItem,
  type LayoutHeaderExtensionAreaName,
  removeLayoutHeaderExtensionAreaItem,
  useLayoutHeaderExtensionArea,
} from '@vben/layouts/basic/header-extension-area';

export const DraggableFloatingPanel = defineAsyncComponent(
  () => import('./framework-commons/shared/draggable-floating-panel.vue'),
);
export const DraggableFloatingPanelHost = defineAsyncComponent(
  () => import('./framework-commons/shared/draggable-floating-panel-host.vue'),
);
export const UserOrgSelector = defineAsyncComponent(
  () => import('./framework-commons/shared/user-org-selector.vue'),
);
