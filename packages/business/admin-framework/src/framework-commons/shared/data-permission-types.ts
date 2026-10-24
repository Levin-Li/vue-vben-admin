export interface OrgTreeNode {
  children?: OrgTreeNode[];
  id: string;
  name?: string;
  title?: string;
}

export interface RbacDataAttrGroup {
  attributes: string[];
  entityName?: string;
  entityScope?: boolean;
  legacyPermissionExpr?: string;
  name: string;
  permissionExpr: string;
  remark?: string;
  scopeKey?: string;
}

/** 后端提供的枚举记录范围；许可表达式必须原样保存。 */
export interface DataAttrValuePermission {
  attribute: string;
  entityClass: string;
  entityName?: string;
  name: string;
  remark?: string;
  values: { label: string; name: string; permissionExpr: string }[];
}

export interface RbacActionNode {
  action?: string;
  attrGroups?: RbacDataAttrGroup[];
  id?: null | string;
  label?: null | string;
  name?: null | string;
  permissionExpr: string;
}

export interface RbacResourceNode {
  actionList?: RbacActionNode[];
  domain?: string;
  id?: null | string;
  name?: null | string;
  type?: string;
}

export interface RbacTypeNode {
  id: string;
  name?: string;
  resList?: RbacResourceNode[];
}

export interface RbacModuleNode {
  id: string;
  name?: string;
  typeList?: RbacTypeNode[];
}

export enum PermissionTreeNodeType {
  Action = 'Action',
  Group = 'Group',
  Menu = 'Menu',
  Module = 'Module',
  Permission = 'Permission',
  Resource = 'Resource',
  ResourceType = 'ResourceType',
}

export interface PermissionTreeNode {
  attrGroups?: RbacDataAttrGroup[];
  children?: PermissionTreeNode[];
  dataAttrs?: DataAttrValuePermission[];
  id: string;
  label?: null | string;
  name: string;
  nodeType: `${PermissionTreeNodeType}`;
  permissionExpr?: null | string;
  remark?: null | string;
  resourcePermissions?: PermissionTreeNode[];
}

export interface RbacMenuNode {
  children?: null | RbacMenuNode[];
  id?: string;
  label?: null | string;
  moduleId?: null | string;
  name?: null | string;
  opButtonList?: null | RbacMenuOpButton[];
  orderCode?: null | number;
  parentId?: null | string;
  path?: null | string;
}

export interface RbacMenuOpButton {
  disabled?: boolean;
  label?: null | string;
  name?: null | string;
  opName?: null | string;
  remark?: null | string;
  requireAuthorizations?: null | string[];
}

export type DataPermissionSubjectType = 'role' | 'user';

export interface DataPermissionPreviewPayload {
  detail: Record<string, any>;
  expressionTypes?: string[];
  modules?: RbacModuleNode[];
  orgTree: OrgTreeNode[];
}
