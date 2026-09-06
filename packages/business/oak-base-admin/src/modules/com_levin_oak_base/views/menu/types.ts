import type { MenuFixedQuery } from '@levin/admin-framework/framework-commons/menu-fixed-query';

export interface MenuOpButton {
  disabled?: boolean;
  label?: string;
  opName?: string;
  remark?: string;
  requireAuthorizations?: string[];
}

export interface MenuRecord {
  actionType?: string;
  alwaysShow?: boolean;
  children?: MenuRecord[];
  createTime?: string;
  domain?: string;
  editable?: boolean;
  enable?: boolean;
  icon?: string;
  id?: string;
  label?: string;
  lastUpdateTime?: string;
  moduleId?: string;
  name?: string;
  opButtonList?: MenuOpButton[];
  optimisticLock?: number;
  orderCode?: number;
  pageType?: string;
  params?: MenuFixedQuery;
  paramsEditor?: string;
  parent?: MenuRecord;
  parentId?: string;
  path?: string;
  publicAccess?: boolean;
  remark?: string;
  requireAuthorizations?: string[];
  sourceFilePath?: string;
  target?: string;
  tenantId?: string;
  viewPath?: string;
}

export interface SelectOption {
  color?: string;
  label: string;
  value: boolean | number | string;
}

export interface MenuActionClickParams<T = MenuRecord> {
  code: string;
  row: T;
}

export type MenuActionClickFn<T = MenuRecord> = (
  params: MenuActionClickParams<T>,
) => void;
