import type { CrudFieldConfig } from './types';

export function shouldReloadRemoteOptionsOnDropdownOpen(
  field: CrudFieldConfig,
) {
  // 只要候选来自加载器，就等到用户展开下拉框再请求，避免页面初始化批量请求。
  return !!field.loadOptions;
}

export function shouldApplyFieldOptionsRequest(
  requestVersion: number,
  latestRequestVersion: number | undefined,
) {
  return requestVersion === latestRequestVersion;
}

export function shouldLoadFieldOptions(
  hasOptionsLoader: boolean,
  isFieldVisible: boolean,
) {
  return hasOptionsLoader && isFieldVisible;
}
