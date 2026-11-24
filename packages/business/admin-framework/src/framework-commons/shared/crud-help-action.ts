import { shallowRef } from 'vue';

/** 宿主可注册标准 CRUD 的帮助入口；业务上下文仅传页面名称和路径。 */
export interface CrudHelpAction {
  open: (context: { path: string; title: string }) => Promise<void> | void;
  permissions: string[];
}

export const crudHelpAction = shallowRef<CrudHelpAction>();

export function registerCrudHelpAction(action: CrudHelpAction) {
  crudHelpAction.value = action;
}
