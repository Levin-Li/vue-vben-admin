export interface OrgScopeItem {
  /**
   * 旧字段兼容：后端 OrgScope 已改为 orgScopeExpressionType。
   */
  expressionType?: string;
  isAllow: boolean;
  orgId: string;
  orgScopeExpression: string;
  orgScopeExpressionType?: string;
  /**
   * 旧字段兼容：后端 OrgScope 已改为 tenantMatchingExpression。
   */
  tenantExpression?: string;
  tenantMatchingExpression?: string;
}

export interface OrgScopeDraft extends OrgScopeItem {
  mode: 'advanced' | 'template';
  orgName?: string;
  orgScopeExpressionType: string;
  templateKey: string;
  tenantMatchingExpression: string;
}

export interface OrgTreeNode {
  children?: OrgTreeNode[];
  id: string;
  name?: string;
  title?: string;
}

export interface RbacActionNode {
  action?: string;
  id?: null | string;
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

export type DataPermissionSubjectType = 'role' | 'user';

export interface DataPermissionPreviewPayload {
  detail: Record<string, any>;
  expressionTypes?: string[];
  modules?: RbacModuleNode[];
  orgTree: OrgTreeNode[];
}
