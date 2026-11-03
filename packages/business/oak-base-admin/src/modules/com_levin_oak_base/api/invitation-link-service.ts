import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export type InvitationTarget =
  | 'ChannelPartner'
  | 'Customer'
  | 'Internal'
  | 'Member'
  | 'SupplierPartner';
export type InvitationUserType = 'Administrator' | 'Employee';
export type InvitationRegistrationChannel =
  | 'Either'
  | 'Email'
  | 'Phone'
  | 'ThirdParty'
  | 'Unrestricted';
export type InvitationUsageMode = 'Limited' | 'Single' | 'Unlimited';

export interface CreateInvitationLinkRequest {
  accountType?: string;
  channelPartnerId?: string;
  channelPartnerType?:
    | 'Agent'
    | 'Dealer'
    | 'Distributor'
    | 'OfflineStore'
    | 'OnlineStore';
  childOrgType?: string;
  customerType?: 'ChannelCustomer' | 'DirectCustomer';
  expiresAt: null | string;
  maxRegistrations?: number;
  organizationCategory?: string;
  organizationMode?: 'CreateChildOrg' | 'JoinInviterOrg';
  registrationChannel: InvitationRegistrationChannel;
  supplierPartnerType?:
    | 'ContentAndCopyright'
    | 'Goods'
    | 'Logistics'
    | 'Operation'
    | 'Other'
    | 'Parts'
    | 'RawMaterials'
    | 'Service'
    | 'Technology';
  targetOrgId: string;
  tenantId?: string;
  usageMode: InvitationUsageMode;
  userType?: InvitationUserType;
}

export interface InvitationTargetOrganization {
  id: string;
  name: string;
}

export interface InvitationTargetTenant {
  id: string;
  name: string;
}

export interface InvitationLinkInfo extends CreateInvitationLinkRequest {
  createdAt: string;
  id: string;
  status: string;
  successCount: number;
  targetOrgName?: string;
  targetType: InvitationTarget;
}

export interface InvitationLinkUrl {
  id: string;
  url: string;
}

export interface InvitationLinkListQuery {
  expiresAfter?: string;
  expiresBefore?: string;
  pageIndex: number;
  pageSize: number;
  registrationChannel?: InvitationRegistrationChannel;
  targetType?: InvitationTarget;
  tenantId?: string;
  usageMode?: InvitationUsageMode;
  userType?: InvitationUserType;
}

export interface InvitationLinkPage {
  items: InvitationLinkInfo[];
  pageIndex: number;
  pageSize: number;
  total: number;
}

// com.levin.oak.base.controller.InvitationLinkAdminController 对创建和管理动作逐项授权。
@Service({
  basePath: '/InvitationLink',
  controllerClass:
    'com.levin.oak.base.controller.InvitationLinkAdminController',
  title: '邀请链接',
  type: '业务数据-邀请链接',
})
export class InvitationLinkService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '邀请子组织管理员',
  })
  async canInviteChildAdmin() {
    return this.post<boolean>('canInviteChildAdmin');
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '邀请组织管理员',
  })
  async canInviteOrgAdmin() {
    return this.post<boolean>('canInviteOrgAdmin');
  }

  @CRUD.Op({ label: '复制邀请链接', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '复制我的邀请链接',
  })
  async copyLink(id: string) {
    return this.post<InvitationLinkUrl>('copyLink', { data: { id } });
  }

  @CRUD.Op({ label: '创建渠道伙伴邀请', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '创建渠道伙伴邀请',
  })
  async createChannelPartner(data: CreateInvitationLinkRequest) {
    return this.post<InvitationLinkUrl>('createChannelPartner', { data });
  }

  @CRUD.Op({ label: '创建客户邀请', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '创建客户邀请',
  })
  async createCustomer(data: CreateInvitationLinkRequest) {
    return this.post<InvitationLinkUrl>('createCustomer', { data });
  }

  @CRUD.Op({ label: '创建内部用户邀请', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '创建内部用户邀请',
  })
  async createInternal(data: CreateInvitationLinkRequest) {
    return this.post<InvitationLinkUrl>('createInternal', { data });
  }

  @CRUD.Op({ label: '创建会员用户邀请', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '创建会员用户邀请',
  })
  async createMember(data: CreateInvitationLinkRequest) {
    return this.post<InvitationLinkUrl>('createMember', { data });
  }

  @CRUD.Op({ label: '创建供应伙伴邀请', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '创建供应伙伴邀请',
  })
  async createSupplierPartner(data: CreateInvitationLinkRequest) {
    return this.post<InvitationLinkUrl>('createSupplierPartner', { data });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '查看我的邀请链接',
  })
  async list(data: InvitationLinkListQuery) {
    return this.post<InvitationLinkPage>('list', { data });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '查看我的邀请链接',
  })
  async retrieve(id: string) {
    return this.post<InvitationLinkInfo>('retrieve', { data: { id } });
  }

  @CRUD.Op({ label: '作废邀请链接', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-邀请链接',
    action: '作废我的邀请链接',
  })
  async revoke(id: string, reason: string) {
    return this.post<{ id: string; revokedAt: string }>('revoke', {
      data: { id, reason },
    });
  }

  @ResAuthorize({ onlyRequireAuthenticated: true })
  async targetChannels(
    targetOrgId: string,
    tenantId?: string,
    keyword?: string,
  ) {
    return this.post<Array<{ id: string; name: string }>>('targetChannels', {
      data: {
        targetOrgId,
        ...(tenantId ? { tenantId } : {}),
        ...(keyword ? { keyword } : {}),
      },
    });
  }

  @ResAuthorize({ onlyRequireAuthenticated: true })
  async targetDictionaryOptions(
    field: 'accountType' | 'organizationCategory',
    tenantId?: string,
  ) {
    return this.post<Array<{ label: string; value: string }>>(
      'targetDictionaryOptions',
      {
        data: { field, ...(tenantId ? { tenantId } : {}) },
      },
    );
  }

  @ResAuthorize({ onlyRequireAuthenticated: true })
  async targetOrganizations(tenantId?: string) {
    return this.post<InvitationTargetOrganization[]>('targetOrganizations', {
      data: tenantId ? { tenantId } : {},
    });
  }

  @ResAuthorize({ onlyRequireAuthenticated: true })
  async targetTenants() {
    return this.post<InvitationTargetTenant[]>('targetTenants');
  }
}

export const invitationLinkService = new InvitationLinkService();
