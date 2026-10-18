import { moduleFetchCrudList } from '../api-module';

const PAGE_SIZE = 50;

type ChannelPartner = {
  displayName?: string;
  enable?: boolean;
  id?: number | string;
  legalSubjectName?: string;
  orgId?: number | string;
  type?: string;
};

// 服务端按当前登录人的租户、组织和数据范围过滤，由渠道子类型接口限定身份。
export async function loadChannelPartnerPage(
  pageIndex: number,
  tenantId?: number | string,
  keyword = '',
) {
  const result = await moduleFetchCrudList<ChannelPartner>(
    '/ChannelPartner/list',
    {
      enable: true,
      id: keyword.trim() || undefined,
      pageIndex,
      pageSize: PAGE_SIZE,
      tenantId,
    },
  );
  const items = result.items || [];
  return {
    hasMore: items.length === PAGE_SIZE,
    options: items
      .filter(
        (partner) =>
          partner.id !== null &&
          partner.id !== undefined &&
          partner.enable !== false,
      )
      .map((partner) => ({
        label: `${partner.displayName || `渠道伙伴 ${partner.id}`} · 组织 ${partner.orgId || '当前组织'} · ${partner.type || '渠道'}`,
        value: partner.id as number | string,
      })),
  };
}
