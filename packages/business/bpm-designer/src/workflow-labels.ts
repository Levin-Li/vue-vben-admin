import type { WorkflowVersionLifecycle } from './types';

/** 生命周期中文标签只用于显示，状态迁移仍使用服务端枚举值。 */
export const workflowLifecycleLabels: Readonly<
  Record<WorkflowVersionLifecycle, string>
> = {
  Draft: '草稿',
  Testing: '测试中',
  Published: '已发布',
  Retiring: '下线中',
  Retired: '已下线',
  Archived: '已归档',
};

/** 二次验证文案对应后端 VerifyCodeType 的 @Schema 标题，值始终保留枚举名。 */
export const workflowVerificationOptions = [
  { value: 'Captcha', label: '图片验证码' },
  { value: 'Hmi', label: '人机交互验证' },
  { value: 'Sms', label: '短信验证码' },
  { value: 'Email', label: '邮箱验证码' },
  { value: 'Mfa', label: '多因子验证码' },
] as const;

/** 运行任务只展示服务端允许的方式；未知值明确标识，避免误认成已支持类型。 */
export function workflowVerificationLabel(type: string): string {
  return (
    workflowVerificationOptions.find((option) => option.value === type)
      ?.label ?? `未识别的验证方式（${type}）`
  );
}
