import { aclTestService } from '../../api/acl-test-service';

export const pageMeta = {
  name: 'AclTest',
  title: '访问控制测试',
  description: '通过真实请求验证短信、邮箱、MFA、行为验证码和请求签名。',
} as const;

export const pageOperations = [
  { opName: 'sms', apiMethods: [aclTestService.sms] },
  { opName: 'email', apiMethods: [aclTestService.email] },
  { opName: 'mfa', apiMethods: [aclTestService.mfa] },
  { opName: 'hmi', apiMethods: [aclTestService.hmi] },
  { opName: 'sign', apiMethods: [aclTestService.sign] },
];
