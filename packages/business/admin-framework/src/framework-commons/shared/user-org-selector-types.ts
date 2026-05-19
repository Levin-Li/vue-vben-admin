export type UserOrgSelectorKind = 'org' | 'user';

export type UserOrgSelectorMode = 'both' | 'org' | 'user';

export type UserOrgSelectorValueMode = 'id' | 'record';

export interface UserOrgSelectorRecord {
  id: string;
  kind: UserOrgSelectorKind;
  name: string;
  orgId?: string;
  orgName?: string;
  raw?: Record<string, any>;
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

export type UserOrgSelectorResolveRecords = (
  ids: string[],
) => Promise<UserOrgSelectorRecord[]>;

export interface UserOrgTreeSelectNode extends UserOrgSelectorRecord {
  canLoadUsers?: boolean;
  children?: UserOrgTreeSelectNode[];
  disabled?: boolean;
  isLeaf?: boolean;
  key: string;
  label: string;
  selectable?: boolean;
  title: string;
  value: string;
}
