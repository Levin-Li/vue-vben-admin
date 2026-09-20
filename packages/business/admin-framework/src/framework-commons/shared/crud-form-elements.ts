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
      const normalized = { ...element, formId, formName, key, fieldKeys: [...(element.fieldKeys || [])] };
      if (index < 0) elements.push(normalized);
      else elements[index] = { ...elements[index], ...normalized };
    },
  };
}

/** 自定义表单控件在 setup 期登记自身，不依赖 DOM 是否已渲染。 */
export function useCrudFormElementRegistration() {
  const registry = inject(CRUD_FORM_ELEMENT_REGISTRY_KEY, undefined);
  return registry?.register;
}
