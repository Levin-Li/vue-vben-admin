import { baseRequestClient } from './request';

// 请求客户端已包含模块 API 前缀，这里只拼公开控制器的相对路径。
const BASE_PATH = '/InvitationRegister';

export interface InvitationPreview {
  childOrgType?: string;
  expiresAt: string;
  organizationMode?: string;
  registrationChannel:
    | 'Either'
    | 'Email'
    | 'Phone'
    | 'ThirdParty'
    | 'Unrestricted';
  remainingRegistrations?: number;
  requiresExternalOrganization?: boolean;
  targetType: string;
  userType?: string;
}

export interface InvitationRedeemRequest {
  account: string;
  legalSubjectName?: string;
  name: string;
  organizationName?: string;
  password: string;
  token: string;
  unifiedCreditNo?: string;
  verificationCode: string;
  verifyCodeType: 'Email' | 'Sms';
}

export interface InvitationRedeemResult {
  accountId: string;
  businessId?: string;
  organizationId?: string;
}

// com.levin.oak.base.controller.InvitationRegisterController 的公开端点仅接受完整令牌和受控注册资料。
export const invitationRegisterService = {
  preview(token: string) {
    return baseRequestClient.post<InvitationPreview>(`${BASE_PATH}/preview`, {
      token,
    });
  },
  redeem(data: InvitationRedeemRequest) {
    return baseRequestClient.post<InvitationRedeemResult>(
      `${BASE_PATH}/redeem`,
      data,
    );
  },
};
