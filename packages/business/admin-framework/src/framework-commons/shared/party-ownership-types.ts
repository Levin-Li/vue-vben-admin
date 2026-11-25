/** 单个归属组及调用方根据当前请求授权生成的可见性。 */
export interface PartyOwnershipGroup {
  key: string;
  label: string;
  orgLabel: string;
  userLabel: string;
  orgField: string;
  userField: string;
  orgId?: null | string;
  userId?: null | string;
  /** 由服务端按权限返回，不能仅凭已脱敏字段推断。 */
  bound: boolean;
  canReadOrg: boolean;
  canReadUser: boolean;
  canWriteOrg: boolean;
  canWriteUser: boolean;
  canBind: boolean;
  canAdjust: boolean;
  orgTypes?: string[];
  orgCategories?: string[];
}

export interface PartyOwnershipChange {
  group: string;
  operation: 'bind' | 'adjust';
  orgField: string;
  userField: string;
  orgChanged: boolean;
  userChanged: boolean;
  orgId?: null | string;
  userId?: null | string;
}

/** 实体静态字段声明，权限和绑定状态须在每次使用时由调用方提供。 */
export interface PartyOwnershipDescriptor {
  key: string;
  label: string;
  orgLabel: string;
  userLabel: string;
  orgField: string;
  userField: string;
  orgTypes?: string[];
  orgCategories?: string[];
}

export interface PartyOwnershipAccess {
  canRead(field: string): boolean;
  canWrite(operation: 'bind' | 'adjust', field: string): boolean;
  canOperate(operation: 'bind' | 'adjust'): boolean;
}
