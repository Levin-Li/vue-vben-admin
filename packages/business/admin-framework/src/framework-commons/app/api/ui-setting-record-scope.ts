import type { UiSettingRuntimeResolution } from './ui-setting-runtime';

/** 保存表单只读取命中记录中的范围字段，解析响应头仅表示请求上下文。 */
export function resolveUiSettingRecordScope(
  resolution: UiSettingRuntimeResolution,
) {
  const setting = resolution.setting;
  if (!setting) return {};

  // 逐字段筛选记录范围，避免把记录元数据或运行时租户、域名带入保存表单。
  const scope = {
    domain: setting.domain,
    orgCategory: setting.orgCategory,
    orgType: setting.orgType,
    tenantId: setting.tenantId,
    userCategory: setting.userCategory,
    userType: setting.userType,
  };
  return Object.fromEntries(
    Object.entries(scope).filter(
      ([, value]) => value !== null && value !== undefined && value !== '',
    ),
  );
}
