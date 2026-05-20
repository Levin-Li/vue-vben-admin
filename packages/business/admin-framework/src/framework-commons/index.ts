export * from './api';
export * from './api-authorize';
export * from './app/options';
export * from './event-bus';
export * from './locale-utils';
export * from './module-contract';
export * from './page-map';
export * from './page-registry';
export * from './rbac-access';
export { default as RbacPermissionMatchUtils } from './rbac-permission-match';
export * from './request-service';
export * from './runtime';
export { default as DraggableFloatingPanelHost } from './shared/draggable-floating-panel-host.vue';
/**
 * Browser-window draggable floating panels.
 *
 * Business modules should register floating content through
 * `useDraggableFloatingPanels(scope)` or `addDraggableFloatingPanel(item)`.
 * The framework root app owns the global `DraggableFloatingPanelHost`; normal
 * pages should not mount another host unless they intentionally need a local
 * scoped floating area.
 */
export * from './shared/draggable-floating-panel-service';
export { default as DraggableFloatingPanel } from './shared/draggable-floating-panel.vue';
/**
 * Dynamic user-dropdown menu registry.
 *
 * Third-party admin modules can add or remove compact actions in the user
 * avatar dropdown without editing the layout template. Use stable ids and
 * `order`; component-scoped registrations are cleaned up automatically on
 * unmount.
 */
export * from './shared/user-dropdown-menu-service';
export * from './shared/user-org-selector-types';
export { default as UserOrgSelector } from './shared/user-org-selector.vue';
/**
 * Dynamic top header extension areas.
 *
 * Use `useLayoutHeaderExtensionArea('center')` for top-center controls and
 * `useLayoutHeaderExtensionArea('right')` for compact controls near the global
 * toolbar. Use stable ids and `order`; component-scoped registrations are
 * cleaned up automatically on unmount.
 */
export {
  addLayoutHeaderExtensionAreaItem,
  clearLayoutHeaderExtensionArea,
  getLayoutHeaderExtensionAreaItems,
  type LayoutHeaderExtensionAreaItem,
  type LayoutHeaderExtensionAreaName,
  removeLayoutHeaderExtensionAreaItem,
  useLayoutHeaderExtensionArea,
} from '@vben/layouts/basic/header-extension-area';
