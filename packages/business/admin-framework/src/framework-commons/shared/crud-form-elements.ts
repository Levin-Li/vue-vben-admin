import type { InjectionKey } from 'vue';

import { inject, reactive } from 'vue';

export type CrudFormElementView = 'create' | 'detail' | 'edit' | 'query';

/** 页面声明的表单元素；fieldKeys 表示该元素实际读写的接口字段。 */
export interface CrudFormElementDeclaration {
  fieldKeys?: string[];
  /** 页面内稳定且唯一的表单标识，用于持久化配置匹配。 */
  formId: string;
  /** 页面内稳定且唯一的表单名称，用于展示与开发识别。 */
  formName: string;
  /** 显式启用按 formId 隔离的展示配置，旧表单继续使用原字段键。 */
  isolateDisplay?: boolean;
  key: string;
  label: string;
  view: CrudFormElementView;
}

export interface CrudFormElementRegistry {
  elements: CrudFormElementDeclaration[];
  register: (element: CrudFormElementDeclaration) => void;
}

export const CRUD_FORM_ELEMENT_REGISTRY_KEY: InjectionKey<CrudFormElementRegistry> =
  Symbol('crud-form-element-registry');

/** 专用表单字段以表单标识和字段标识共同存储，避免同视图重名覆盖。 */
export function externalCrudFormDisplayKey(formId: string, fieldKey: string) {
  return `form:${encodeURIComponent(formId)}:${encodeURIComponent(fieldKey)}`;
}

/** 仅按完整表单身份查找，普通 CRUD 和其他表单的同名字段不会继承其设置。 */
export function resolveExternalCrudFormDisplayField<T extends { key: string }>(
  fields: readonly T[] | undefined,
  formId: string,
  fieldKey: string,
) {
  const key = externalCrudFormDisplayKey(formId, fieldKey);
  return fields?.find((field) => field.key === key);
}

/** 配置对象键顺序不参与保存状态判断；数组顺序仍是业务配置。 */
export function stringifyCrudDisplaySnapshot(value: unknown) {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).toSorted(([left], [right]) => left.localeCompare(right)));
  });
}

/** 创建页面级元素注册表；相同 formId/key 的后登记元数据补充既有声明。 */
export function createCrudFormElementRegistry(): CrudFormElementRegistry {
  const elements = reactive<CrudFormElementDeclaration[]>([]);
  return {
    elements,
    register(element) {
      const key = element.key.trim();
      if (!key) return;
      const formId = element.formId.trim();
      const formName = element.formName.trim();
      if (!formId || !formName) return;
      const index = elements.findIndex(
        (item) => item.formId === formId && item.key === key,
      );
      const normalized = {
        ...element,
        formId,
        formName,
        key,
        fieldKeys: [...(element.fieldKeys || [])],
      };
      if (index === -1) elements.push(normalized);
      else elements[index] = { ...elements[index], ...normalized };
    },
  };
}

/** 自定义表单控件在 setup 期登记自身，不依赖 DOM 是否已渲染。 */
export function useCrudFormElementRegistration() {
  const registry = inject(CRUD_FORM_ELEMENT_REGISTRY_KEY, undefined);
  return registry?.register;
}
