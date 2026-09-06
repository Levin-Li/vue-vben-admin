import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { isSuperAdminUser } from '@levin/admin-framework/framework-commons/shared/user-identity';

import { settingService } from '../../api/setting-service';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
} from '../api-module';
import { transformSettingCrudSubmit } from '../setting-crud-submit';

const settingValueTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Setting$ValueType',
);
export const LEGACY_OAUTH_SETTING_CODE_PREFIX = 'oauth_platform_';

type SettingListResult =
  | Record<string, any>
  | Record<string, any>[]
  | {
      data?: Record<string, any>[];
      items?: Record<string, any>[];
      list?: Record<string, any>[];
      records?: Record<string, any>[];
      total?: number;
      totals?: number;
    };

function isLegacyOauthSettingCode(code: unknown) {
  return (
    typeof code === 'string' &&
    code.startsWith(LEGACY_OAUTH_SETTING_CODE_PREFIX)
  );
}

function extractSettingListItems(result: SettingListResult) {
  if (Array.isArray(result)) {
    return result;
  }

  return result?.items || result?.records || result?.list || result?.data || [];
}

export function filterLegacyOauthSettingItems<T extends { code?: unknown }>(
  items: T[],
) {
  return items.filter((item) => !isLegacyOauthSettingCode(item?.code));
}

function replaceSettingListItems(
  result: SettingListResult,
  items: Record<string, any>[],
  totals: number,
) {
  if (Array.isArray(result)) {
    return items;
  }

  const nextResult = { ...result };

  if (Array.isArray(nextResult.items)) {
    nextResult.items = items;
  }
  if (Array.isArray(nextResult.records)) {
    nextResult.records = items;
  }
  if (Array.isArray(nextResult.list)) {
    nextResult.list = items;
  }
  if (Array.isArray(nextResult.data)) {
    nextResult.data = items;
  }
  if (typeof nextResult.total === 'number') {
    nextResult.total = totals;
  }
  if (typeof nextResult.totals === 'number') {
    nextResult.totals = totals;
  }

  return nextResult;
}

async function listVisibleSettings(params?: any, options?: any) {
  const requestedPageIndex = Math.max(1, Number(params?.pageIndex || 1) || 1);
  const requestedPageSize = Math.max(1, Number(params?.pageSize || 10) || 10);
  const backendPageSize = Math.max(requestedPageSize, 100);
  const visibleItems: Record<string, any>[] = [];
  let visibleTotal = 0;
  let pageIndex = 1;
  let lastResult: SettingListResult | undefined;

  while (true) {
    const result = (await settingService.list(
      {
        ...params,
        pageIndex,
        pageSize: backendPageSize,
      },
      options,
    )) as SettingListResult;
    const pageItems = extractSettingListItems(result);
    const filteredItems = filterLegacyOauthSettingItems(pageItems);
    const rawTotal = Number(
      Array.isArray(result) ? 0 : (result.totals ?? result.total ?? 0),
    );

    visibleTotal += filteredItems.length;
    visibleItems.push(...filteredItems);
    lastResult = result;

    const reachedKnownTotal =
      rawTotal > 0 && pageIndex * backendPageSize >= rawTotal;
    const reachedPageEnd = pageItems.length < backendPageSize;

    if (reachedKnownTotal || reachedPageEnd) {
      break;
    }

    pageIndex += 1;
  }

  const start = (requestedPageIndex - 1) * requestedPageSize;
  const end = start + requestedPageSize;

  return replaceSettingListItems(
    lastResult || { items: [], totals: 0 },
    visibleItems.slice(start, end),
    visibleTotal,
  );
}

const settingPageCrudService = {
  create: settingService.create.bind(settingService),
  delete: settingService.delete.bind(settingService),
  list: listVisibleSettings,
  retrieve: settingService.retrieve.bind(settingService),
  update: settingService.update.bind(settingService),
};

export const pageMeta = {
  name: 'Setting',
  title: '系统设置管理',
  description: '维护系统设置。',
} as const;

export const settingPageCrudConfig: CrudPageConfig = {
  apiBase: '/Setting',
  domainObject: true,
  apiService: settingPageCrudService,
  defaultFormValues: {
    editable: true,
    enable: true,
    nullable: true,
    orderCode: 100,
    valueType: 'Text',
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      layoutOrder: 10,
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForPlatformUser: true,
    },
    {
      key: '__tenant',
      detail: false,
      label: '归属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
      width: 180,
    },
    {
      key: 'id',
      label: '设置ID',
      fixed: 'left',
      required: true,
      search: true,
      showIdOnCreate: true,
      table: true,
      width: 180,
    },
    { key: 'containsName', label: '名称', form: false, search: true },
    { key: 'code', label: '编码', form: false, search: true },
    { key: 'categoryName', label: '分类名称', form: false, search: true },
    { key: 'containsGroupName', label: '分组名称', form: false, search: true },
    { key: 'endsWithDomain', label: '域名', form: false, search: true },
    {
      key: 'inValueType',
      label: '值类型',
      form: false,
      loadOptions: settingValueTypeOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'gteCreateTime',
      label: '创建时间开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteCreateTime',
      label: '创建时间结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'name',
      label: '名称',
      layoutGroup: 'basic',
      layoutGroupTitle: '设置标识',
      layoutOrder: 10,
      required: true,
      table: true,
      width: 180,
    },
    {
      key: 'code',
      label: '编码',
      layoutGroup: 'basic',
      layoutOrder: 20,
      required: true,
      table: true,
      width: 180,
    },
    {
      key: 'categoryName',
      label: '分类名称',
      layoutGroup: 'basic',
      layoutOrder: 30,
      required: true,
      table: true,
      width: 140,
    },
    {
      key: 'groupName',
      label: '分组名称',
      layoutGroup: 'basic',
      layoutOrder: 40,
      table: true,
      width: 140,
    },
    {
      key: 'domain',
      label: '域名',
      layoutGroup: 'basic',
      layoutOrder: 50,
      table: true,
      width: 180,
    },
    {
      key: 'icon',
      label: '图标',
      layoutGroup: 'basic',
      layoutOrder: 60,
      type: 'image',
    },
    {
      key: 'valueType',
      label: '值类型',
      layoutGroup: 'content',
      layoutOrder: 10,
      loadOptions: settingValueTypeOptionsLoader,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'editor',
      label: '值编辑器',
      disabledOnEdit: ({ userInfo }) => !isSuperAdminUser(userInfo),
      fullRow: true,
      layoutGroup: 'content',
      layoutNewRow: true,
      layoutOrder: 20,
      type: 'text',
    },
    {
      key: 'valueContent',
      label: '值',
      fullRow: true,
      layoutGroup: 'content',
      layoutOrder: 30,
      type: 'textarea',
    },
    {
      key: 'nullable',
      label: '值是否可空',
      layoutGroup: 'content',
      layoutOrder: 40,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 120,
    },
    {
      key: 'inputPlaceholder',
      label: '输入占位提示',
      fullRow: true,
      layoutGroup: 'content',
      layoutOrder: 50,
      type: 'textarea',
    },
    {
      key: 'pinyinName',
      label: '拼音名',
      layoutGroup: 'basic',
      layoutOrder: 70,
      table: true,
      width: 160,
    },
    {
      key: 'orderCode',
      label: '排序代码',
      layoutGroup: 'status',
      layoutOrder: 10,
      type: 'number',
    },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'status',
      layoutOrder: 20,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      layoutGroup: 'status',
      layoutOrder: 30,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'createTime',
      label: '创建时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
      layoutOrder: 10,
      type: 'textarea',
    },
  ],
  formMaxColumns: 3,
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '系统设置管理',
  transformSubmit: transformSettingCrudSubmit,
};
