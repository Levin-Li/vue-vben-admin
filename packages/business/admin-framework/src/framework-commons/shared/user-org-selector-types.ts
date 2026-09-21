export type UserOrgSelectorKind = 'org' | 'tenant' | 'user';

export type UserOrgSelectorSelectableType = UserOrgSelectorKind;

/** @deprecated 内部过渡别名；持久化配置改用 selectableTypes。 */
export type UserOrgSelectorMode = 'both' | 'org' | 'user';

export type UserOrgSelectorValueMode = 'id' | 'record';

export type UserOrgSelectorOrgLoadMode = 'all' | 'lazy';

export interface UserOrgSelectorRecord {
  id: string;
  kind: UserOrgSelectorKind;
  name: string;
  orgId?: string;
  orgName?: string;
  raw?: Record<string, any>;
  tenantId?: string;
  tenantName?: string;
  type?: string;
}

export type UserOrgSelectorModelValue =
  | Array<string | UserOrgSelectorRecord>
  | string
  | UserOrgSelectorRecord
  | null
  | undefined;

export interface UserOrgSelectorLoadUsersContext {
  org: UserOrgSelectorRecord;
  orgId: string;
  userTypes: string[];
}

export type UserOrgSelectorLoadUsers = (
  context: UserOrgSelectorLoadUsersContext,
) => Promise<Record<string, any>[]>;

export interface UserOrgSelectorLoadOrgTreeContext {
  selectableTypes?: UserOrgSelectorSelectableType[];
  depth: number;
  maxLoadDeep: number;
  onlyLeafNode: boolean;
  onlyNotLeafNode: boolean;
  onlyShowTypeMatchNode: boolean;
  orgLoadMode: UserOrgSelectorOrgLoadMode;
  parentOrg?: UserOrgSelectorRecord;
  parentOrgId?: string;
  rootOrgIdList: string[];
  orgTypes: string[];
}

export type UserOrgSelectorLoadOrgTree = (
  context: UserOrgSelectorLoadOrgTreeContext,
) => Promise<Record<string, any>[]>;

export type UserOrgSelectorResolveRecords = (
  ids: string[],
) => Promise<UserOrgSelectorRecord[]>;

export interface UserOrgTreeSelectNode extends UserOrgSelectorRecord {
  canLoadUsers?: boolean;
  children?: UserOrgTreeSelectNode[];
  depth?: number;
  disabled?: boolean;
  hasChildren?: boolean;
  loadAttempted?: boolean;
  isLeaf?: boolean;
  key: string;
  label: string;
  selectable?: boolean;
  title: string;
  value: string;
}
