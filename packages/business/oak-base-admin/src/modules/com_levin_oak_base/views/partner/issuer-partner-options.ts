import { moduleFetchCrudList } from '../api-module';

const PAGE_SIZE = 50;

type LegalSubjectOptionRecord = {
  id?: number | string;
  subjectName?: string;
};

type PartnerOptionRecord = {
  displayName?: string;
  enable?: boolean;
  id?: number | string;
  legalSubjectId?: number | string;
  legalSubjectName?: string;
  orgId?: number | string;
  type?: string;
};

export interface IssuerOptionPage {
  hasMore: boolean;
  options: { label: string; value: number | string }[];
}

// 第一步按主体名称查询，始终分页；主体列表只返回当前调用人有权查看的记录。
export async function loadIssuerSubjectPage(
  keyword: string,
  pageIndex: number,
  tenantId?: number | string,
): Promise<IssuerOptionPage> {
  const result = await moduleFetchCrudList<LegalSubjectOptionRecord>(
    '/LegalSubject/list',
    {
      containsSubjectName: keyword.trim() || undefined,
      pageIndex,
      pageSize: PAGE_SIZE,
      tenantId,
    },
  );
  const items = result.items || [];
  return {
    hasMore: items.length === PAGE_SIZE,
    options: items
      .filter((subject) => subject.id !== null && subject.id !== undefined)
      .map((subject) => ({
        label: subject.subjectName || `法律主体 ${subject.id}`,
        value: subject.id as number | string,
      })),
  };
}

// 第二步只查询已选主体的启用供应商关系，值仍是 Partner ID。
export async function loadIssuerRelationPage(
  legalSubjectId: number | string,
  pageIndex: number,
  tenantId?: number | string,
): Promise<IssuerOptionPage> {
  const result = await moduleFetchCrudList<PartnerOptionRecord>(
    '/SupplierPartner/list',
    {
      enable: true,
      legalSubjectId,
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
        label: `${partner.displayName || `合作关系 ${partner.id}`} · 组织 ${partner.orgId || '当前组织'} · ${partner.type || '供应伙伴'}`,
        value: partner.id as number | string,
      })),
  };
}
