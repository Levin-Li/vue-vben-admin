import type { SelectOption } from '@levin/admin-framework';

import { oakBaseGet } from './api/_module';
import { platformDomainService } from './api/platform-domain-service';

const SETTING_CODE = '全局平台领域选择器';

/**
 * 领域候选统一沿用 PlatformDomain/list：仅取远程配置类型前缀下已发布的领域。
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

  const result: any = await platformDomainService.list({
    ...(keyword.trim() ? { containsName: keyword.trim() } : {}),
    pageIndex: 1,
    pageSize: keyword.trim() ? 50 : 10,
    startsWithType: typePrefix,
    state: 'Published',
  });
  const items = result?.items || result?.records || result || [];
  return Array.isArray(items)
    ? items.map((domain) => ({
        label: String(domain.name || domain.id),
        value: String(domain.id),
      }))
    : [];
}
