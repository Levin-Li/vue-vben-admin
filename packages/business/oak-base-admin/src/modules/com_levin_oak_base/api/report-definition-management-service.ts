import { RequestService, ResAuthorize, Service } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

// 页面参数、数据集及组件与后端声明式配置保持一致，不接受脚本或 SQL。
export type ReportParameterType =
  | 'BOOLEAN'
  | 'DATE'
  | 'DATE_RANGE'
  | 'DATETIME'
  | 'DATETIME_RANGE'
  | 'ENUM'
  | 'NUMBER'
  | 'ORGANIZATION'
  | 'TIME_GRAIN'
  | 'TEXT';

export type ReportFieldType =
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'DECIMAL'
  | 'ENUM'
  | 'INTEGER'
  | 'ORGANIZATION'
  | 'STRING';

export interface ReportSourceField {
  choices?: Array<{ label: string; value: string }>;
  id: string;
  title: string;
  type: ReportFieldType;
}

export interface ReportSource {
  fields: ReportSourceField[];
  id: string;
  title: string;
}

export interface ReportRelation {
  id: string;
  leftField: string;
  leftSource: string;
  leftPrimaryKey?: boolean;
  multipliesLeft: boolean;
  rightField: string;
  rightSource: string;
}

export interface ReportSourceCatalog {
  relations: ReportRelation[];
  sources: ReportSource[];
}

export interface ReportParameter {
  choices?: Array<{ label: string; value: string }>;
  key: string;
  required: boolean;
  requiredForAll: boolean;
  title?: string;
  type: ReportParameterType;
}

export interface ReportDatasetField {
  aggregation: 'AVG' | 'COUNT' | 'MAX' | 'MIN' | 'NONE' | 'SUM';
  display?: 'MONEY' | 'PLAIN' | 'QUANTITY';
  grain?: 'DAY' | 'MONTH';
  grainParameter?: string;
  name: string;
  sort?: 'ASC' | 'DESC';
  source: string;
  title?: null | string;
  unit?: string;
}

export interface ReportDatasetFilter {
  boundary?: 'START' | 'END';
  context?: 'AUTHORIZED_ORG_IDS' | 'CURRENT_ORG_ID' | 'CURRENT_TENANT_ID' | 'CURRENT_USER_ID';
  literal?: string;
  name: string;
  operator: 'EQ' | 'GE' | 'IN' | 'LE';
  parameter?: string;
  source: string;
}

export interface ReportDataset {
  aggregationMode?: 'FACT_DISTINCT';
  fields: ReportDatasetField[];
  filters: ReportDatasetFilter[];
  id: string;
  title?: null | string;
  limit?: number;
  relations: string[];
  leftRelations?: string[];
  root: string;
}

export interface ReportComponent {
  background?: { color?: string; gradient?: ReportGradient };
  bindings: Record<string, string>;
  dataset: string;
  id: string;
  position: { height: number; width: number; x: number; y: number };
  title: string;
  tone?: 'AMBER' | 'LAVENDER' | 'NEUTRAL' | 'ROSE';
  showTable?: boolean;
  type: 'BAR' | 'LINE' | 'METRIC' | 'PIE' | 'TABLE';
}

export interface ReportPageDesign {
  background: { color?: string; gradient?: ReportGradient; image?: string };
  components: ReportComponent[];
  datasets: ReportDataset[];
  layout: 'CANVAS' | 'GRID';
  parameters: ReportParameter[];
  title: string;
  version: 1;
}

export interface ReportGradient {
  direction: 'DIAGONAL' | 'HORIZONTAL' | 'VERTICAL';
  from: string;
  to: string;
}

export interface ReportManagementSummary {
  definitionVersion: number;
  menuId?: null | string;
  name: string;
  orgId?: null | string;
  publishedVersion?: null | number;
  reportId: string;
}

export interface ReportManagementInfo extends ReportManagementSummary {
  draft: null | ReportPageDesign;
  optimisticLock: number;
  publicationLogs?: Array<{ occurTime?: null | string; operator?: null | string; action?: null | string; remark?: null | string }>;
}

export interface ReportManagementPage {
  items: ReportManagementSummary[];
  pageIndex: number;
  pageSize: number;
  totals: number;
}

export interface ReportVersion {
  expectedDefinitionVersion: number;
  expectedLock: number;
  reportId: string;
}

export interface CreateReportInput {
  design: ReportPageDesign;
  name: string;
  orgId?: null | string;
}

export interface SaveReportDraftInput extends ReportVersion {
  design: ReportPageDesign;
  menuId?: null | string;
  name: string;
}

// 权限元数据对应报表定义管理控制器，后端仍独立校验租户、组织和菜单绑定。
@Service({
  basePath: '/ReportDefinitionManagement',
  controllerClass:
    'com.levin.oak.base.controller.ReportDefinitionManagementController',
  description: '报表定义、草稿及发布管理。',
  title: '报表定义',
  type: '平台数据-报表定义',
})
export class ReportDefinitionManagementService extends RequestService {
  constructor(private readonly silentErrors = false) {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '查询列表',
  })
  async catalog(): Promise<ReportSourceCatalog> {
    return this.get<ReportSourceCatalog>('catalog', this.silentErrors ? { __silentError: true } : {});
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '查询列表',
  })
  async capabilities(): Promise<{ menuGenerationEnabled: boolean; writeEnabled?: boolean; savedPreviewEnabled?: boolean }> {
    return this.get('capabilities', this.silentErrors ? { __silentError: true } : {});
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '查询列表',
  })
  async list(data: {
    pageIndex: number;
    pageSize: number;
  }): Promise<ReportManagementPage> {
    return this.post<ReportManagementPage>('list', { data, ...(this.silentErrors ? { __silentError: true } : {}) });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '查看详情',
  })
  async getDraft(reportId: string): Promise<ReportManagementInfo> {
    return this.post<ReportManagementInfo>('getDraft', { data: { reportId }, ...(this.silentErrors ? { __silentError: true } : {}) });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '新增',
  })
  async create(data: CreateReportInput): Promise<string> {
    return this.post<string>('create', { data, ...(this.silentErrors ? { __silentError: true } : {}) });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '更新',
  })
  async saveDraft(data: SaveReportDraftInput): Promise<void> {
    await this.post('saveDraft', { data, ...(this.silentErrors ? { __silentError: true } : {}) });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '发布',
  })
  async publish(data: ReportVersion): Promise<void> {
    await this.post('publish', { data, ...(this.silentErrors ? { __silentError: true } : {}) });
  }
}

export const reportDefinitionManagementService =
  new ReportDefinitionManagementService();
