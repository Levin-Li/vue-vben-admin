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

export interface CreateRecommendationLinkRequest {
  channelPartnerId?: string;
  channelPartnerType?:
    | 'Agent'
    | 'Dealer'
    | 'Distributor'
    | 'OfflineStore'
    | 'OnlineStore';
  childOrgType?: string;
  customerType?: 'ChannelCustomer' | 'DirectCustomer';
  expiresAt: string;
  maxRegistrations?: number;
  organizationMode?: 'CreateChildOrg' | 'JoinInviterOrg';
  registrationChannel: InvitationRegistrationChannel;
  supplierPartnerType?:
    | 'Goods'
    | 'Logistics'
    | 'Operation'
    | 'Other'
    | 'Parts'
    | 'RawMaterials'
    | 'Service'
    | 'Technology';
  usageMode: InvitationUsageMode;
  userType?: InvitationUserType;
}

export interface RecommendationLinkInfo extends CreateRecommendationLinkRequest {
  createdAt: string;
  id: string;
  status: string;
  successCount: number;
  targetType: InvitationTarget;
}

export interface RecommendationLinkUrl {
  id: string;
  url: string;
}

export interface RecommendationLinkPage {
  items: RecommendationLinkInfo[];
  pageIndex: number;
  pageSize: number;
  total: number;
}

// com.levin.oak.base.controller.InvitationLinkAdminController 对创建和管理动作逐项授权。
@Service({
  basePath: '/RecommendationLink',
  controllerClass:
    'com.levin.oak.base.controller.InvitationLinkAdminController',
  title: '邀请注册链接',
  type: '业务数据-推荐链接',
})
export class RecommendationLinkService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-推荐链接',
    action: '邀请子组织管理员',
  })
  async canInviteChildAdmin() {
    return this.post<boolean>('canInviteChildAdmin');
  }

  @CRUD.Op({ label: '复制推荐链接', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-推荐链接',
    action: '复制我的推荐链接',
  })
  async copyLink(id: string) {
    return this.post<RecommendationLinkUrl>('copyLink', { data: { id } });
  }

  @CRUD.Op({ label: '创建渠道伙伴邀请', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-推荐链接',
    action: '创建渠道伙伴邀请',
  })
  async createChannelPartner(data: CreateRecommendationLinkRequest) {
    return this.post<RecommendationLinkUrl>('createChannelPartner', { data });
  }

  @CRUD.Op({ label: '创建客户邀请', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-推荐链接',
    action: '创建客户邀请',
  })
  async createCustomer(data: CreateRecommendationLinkRequest) {
    return this.post<RecommendationLinkUrl>('createCustomer', { data });
  }

  @CRUD.Op({ label: '创建内部用户邀请', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-推荐链接',
    action: '创建内部用户邀请',
  })
  async createInternal(data: CreateRecommendationLinkRequest) {
    return this.post<RecommendationLinkUrl>('createInternal', { data });
  }

  @CRUD.Op({ label: '创建会员用户邀请', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-推荐链接',
    action: '创建会员用户邀请',
  })
  async createMember(data: CreateRecommendationLinkRequest) {
    return this.post<RecommendationLinkUrl>('createMember', { data });
  }

  @CRUD.Op({ label: '创建供应伙伴邀请', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-推荐链接',
    action: '创建供应伙伴邀请',
  })
  async createSupplierPartner(data: CreateRecommendationLinkRequest) {
    return this.post<RecommendationLinkUrl>('createSupplierPartner', { data });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-推荐链接',
    action: '查看我的推荐链接',
  })
  async list(data: { pageIndex: number; pageSize: number }) {
    return this.post<RecommendationLinkPage>('list', { data });
  }

  @CRUD.Op({ label: '作废推荐链接', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-推荐链接',
    action: '作废我的推荐链接',
  })
  async revoke(id: string, reason: string) {
    return this.post<{ id: string; revokedAt: string }>('revoke', {
      data: { id, reason },
    });
  }
}

export const recommendationLinkService = new RecommendationLinkService();
