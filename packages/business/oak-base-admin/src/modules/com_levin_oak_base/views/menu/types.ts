export interface MenuOpButton {
  apiUrl?: string;
  disabled?: boolean;
  label?: string;
  remark?: string;
  requireAuthorization?: string;
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
  params?: string;
  parent?: MenuRecord;
  parentId?: string;
  path?: string;
  remark?: string;
  requireAuthorizations?: string[];
  target?: string;
  tenantId?: string;
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
