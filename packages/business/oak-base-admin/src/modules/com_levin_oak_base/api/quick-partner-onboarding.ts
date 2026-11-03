export type QuickAddTarget = 'ChannelPartner' | 'Customer' | 'SupplierPartner';

export interface QuickAddResult {
  businessId: string;
  legalSubjectId: string;
  loginName: string;
  orgId: string;
  userId: string;
}

export interface QuickAddPayload {
  adminName?: string;
  channelType?:
    | 'Agent'
    | 'Dealer'
    | 'Distributor'
    | 'OfflineStore'
    | 'OnlineStore';
  creditCode: string;
  legalSubjectName: string;
  loginName?: string;
  password?: string;
  shortName: string;
  subjectType: 'Individual' | 'Legal' | 'NotLegal';
  supplierType?:
    | 'ContentAndCopyright'
    | 'Goods'
    | 'Logistics'
    | 'Operation'
    | 'Other'
    | 'Parts'
    | 'RawMaterials'
    | 'Service'
    | 'Technology';
  telephone: string;
}
