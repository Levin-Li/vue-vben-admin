import type { SelectOption } from '@levin/admin-framework';

import { oakBaseGet } from './api/_module';
import { loadAuthorizedPlatformDomainList } from './api/rbac-service';

const SETTING_CODE = '全局平台领域选择器';

/**
 * 领域候选由 RbacController 从缓存读取并按当前用户领域权限过滤；前端配置只用于收窄类型范围。
 * 列表接口仍由服务端按当前操作者的数据范围过滤，前端不维护第二套授权接口。
 */
export async function loadDomainScopeOptions(
  keyword = '',
): Promise<SelectOption[]> {
  let setting: any;
  try {
    setting = await oakBaseGet('/UiSetting/use/resolve', {
      params: { code: SETTING_CODE },
    });
  } catch {
    // 远程未配置该 UI Setting 时，领域选择器应直接隐藏；不能阻断其它数据范围 Tab。
    return [];
  }
  const typePrefix = String(setting?.valueContent?.type || '').trim();
  if (!typePrefix) {
    return [];
  }

  const items = await loadAuthorizedPlatformDomainList({
    ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
    typePrefix,
  });
  return Array.isArray(items)
    ? items.map((domain) => ({
        label: String(domain.name || domain.id),
        value: String(domain.id),
      }))
    : [];
}

/** 权限分配必须列出当前操作者的全部授权领域，不受全局选择器 UI Setting 限制。 */
export async function loadDataPermissionDomainOptions(
  keyword = '',
): Promise<SelectOption[]> {
  const items = await loadAuthorizedPlatformDomainList(
    keyword.trim() ? { keyword: keyword.trim() } : undefined,
  );
  return Array.isArray(items)
    ? items.map((domain) => ({
        label: String(domain.name || domain.id),
        value: String(domain.id),
      }))
    : [];
}
