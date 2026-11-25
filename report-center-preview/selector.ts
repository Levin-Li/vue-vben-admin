import { defineComponent, h } from 'vue';
import type { Component } from 'vue';
import { Select } from 'ant-design-vue';
export { CRUD, ResAuthorize, Service } from '../packages/business/admin-framework/src/framework-commons/api-authorize';
export { RequestService } from '../packages/business/admin-framework/src/framework-commons/request-service';
export { getAdminMenuSyncService, getAdminRequestClient, getAdminUserSecurityService, requestClient, setAdminFrameworkRuntime } from '../packages/business/admin-framework/src/framework-commons/runtime';
export { createAdminPageResolver, mergeAdminPageMaps, normalizeAdminGlobPageMap } from '../packages/business/admin-framework/src/framework-commons/page-registry';
export { matchesPinyinFuzzySearch } from '../packages/business/admin-framework/src/framework-commons/shared/pinyin-fuzzy-search';
export const adminFrameworkPageMap = {};

// 预览替换组织选择器时保留菜单映射汇总，避免加载整个应用入口。
export function collectAdminModuleBackendRouteMappings<T>(modules: Array<{ backendRouteMappings?: T[] }>): T[] {
  return modules.flatMap((module) => module.backendRouteMappings || []);
}
export function collectAdminModulePageMap<T>(modules: Array<{ pageMap?: Record<string, T> }>): Record<string, T> {
  return Object.assign({}, ...modules.map((module) => module.pageMap || {}));
}
export function collectAdminModuleRoutes<T>(modules: Array<{ routes?: T[] }>): T[] {
  return modules.flatMap((module) => module.routes || []);
}

export const UserOrgSelector = defineComponent({
  props: { modelValue: String }, emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h(Select as Component, { value: props.modelValue || '', style: { width: '160px' },
      options: [{ value: '', label: '全部组织' }, { value: 'north', label: '华北组织' }, { value: 'south', label: '华南组织' }],
      'onUpdate:value': (value: string) => emit('update:modelValue', value),
    });
  },
});
