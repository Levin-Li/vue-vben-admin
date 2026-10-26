import { electronicInvoiceProviderConnectionService } from '../../api/electronic-invoice-provider-connection-service';

const PAGE_SIZE = 50;

interface AvailableLegalSubject {
  id?: number | string;
  sourceLabels?: string[];
  subjectName?: string;
}

interface AvailableLegalSubjectPage {
  hasMore?: boolean;
  items?: AvailableLegalSubject[];
  total?: number;
}

export interface AuthorizationLegalSubjectOptionPage {
  hasMore: boolean;
  options: { label: string; value: number | string }[];
}

// 候选范围由开票授权专用接口确定，页面只转换公司名称和来源说明。
export async function loadAuthorizationLegalSubjectPage(
  keyword: string,
  pageIndex: number,
  tenantId?: number | string,
): Promise<AuthorizationLegalSubjectOptionPage> {
  const response =
    (await electronicInvoiceProviderConnectionService.availableLegalSubjects({
      keyword: keyword.trim() || undefined,
      pageIndex,
      pageSize: PAGE_SIZE,
      tenantId,
    })) as AvailableLegalSubjectPage | { data: AvailableLegalSubjectPage };
  const page = 'data' in response ? response.data : response;
  const items = page.items || [];

  let hasMore = items.length === PAGE_SIZE;
  if (typeof page.total === 'number') {
    hasMore = pageIndex * PAGE_SIZE < page.total;
  }
  if (typeof page.hasMore === 'boolean') {
    hasMore = page.hasMore;
  }

  return {
    hasMore,
    options: items
      .filter((item) => item.id !== undefined && item.id !== null)
      .map((item) => ({
        label: [
          item.subjectName || `法律主体 ${item.id}`,
          ...(item.sourceLabels?.length ? [item.sourceLabels.join('、')] : []),
        ].join(' · '),
        value: item.id as number | string,
      })),
  };
}
