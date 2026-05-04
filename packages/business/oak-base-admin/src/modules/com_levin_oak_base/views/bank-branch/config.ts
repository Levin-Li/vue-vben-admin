import type { SelectOption } from '@levin/admin-framework';
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { DEFAULT_CRUD_MODAL_WIDTH, moduleFetchCrudList } from '../api-module';

interface AreaRecord {
  code?: string;
  id?: string;
  name?: string;
  orderCode?: number;
  parentId?: string;
  type?: string;
}

let bankBranchAreaTreeCache: SelectOption[] | null = null;

function normalizeAreaType(type: unknown) {
  return (
    String(type || '')
      .split('.')
      .pop() || ''
  );
}

function isProvinceArea(record: AreaRecord) {
  const type = normalizeAreaType(record.type);
  return type === 'Province' || type.includes('省份');
}

function getAreaOptionValue(area: AreaRecord) {
  return area.code || area.id || '';
}

function buildAreaOption(area: AreaRecord): SelectOption {
  return {
    adminCode: area.id,
    children: [],
    code: getAreaOptionValue(area),
    id: area.id,
    label: area.name || area.id || '',
    name: area.name,
    orderCode: area.orderCode,
    parentId: area.parentId,
    type: area.type,
    value: getAreaOptionValue(area),
  };
}

function sortAreaOptions(options: SelectOption[]) {
  return options.sort((a, b) => {
    const orderDiff = Number(a.orderCode || 0) - Number(b.orderCode || 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }

    return String(a.label).localeCompare(String(b.label), 'zh-CN');
  });
}

function buildAreaTreeOptions(records: AreaRecord[]) {
  const optionMap = new Map<string, SelectOption>();

  for (const record of records) {
    if (!record?.id) {
      continue;
    }

    optionMap.set(record.id, buildAreaOption(record));
  }

  for (const record of records) {
    const option = record?.id ? optionMap.get(record.id) : undefined;
    const parent = record?.parentId
      ? optionMap.get(record.parentId)
      : undefined;

    if (option && parent) {
      parent.children = parent.children || [];
      parent.children.push(option);
    }
  }

  for (const option of optionMap.values()) {
    if (option.children?.length === 0) {
      delete option.children;
    } else if (option.children) {
      sortAreaOptions(option.children);
    }
  }

  const provinceOptions = records
    .filter((record) => isProvinceArea(record))
    .map((record) => optionMap.get(record.id || ''))
    .filter(Boolean) as SelectOption[];

  if (provinceOptions.length > 0) {
    return sortAreaOptions(provinceOptions);
  }

  const rootOptions = records
    .filter((record) => !record.parentId || !optionMap.has(record.parentId))
    .map((record) => optionMap.get(record.id || ''))
    .filter(Boolean) as SelectOption[];

  const nationChildren = rootOptions.flatMap((option) => {
    const type = normalizeAreaType(option.type);
    return type === 'Nation' || type.includes('国家')
      ? option.children || []
      : [];
  });

  return sortAreaOptions(
    nationChildren.length > 0 ? nationChildren : rootOptions,
  );
}

async function bankBranchAreaOptionsLoader() {
  if (bankBranchAreaTreeCache) {
    return bankBranchAreaTreeCache;
  }

  const result = await moduleFetchCrudList<AreaRecord>('/Area/list', {
    inType: ['Province', 'City', 'County'],
    pageIndex: 1,
    pageSize: 5000,
  });
  bankBranchAreaTreeCache = buildAreaTreeOptions(result.items || []);
  return bankBranchAreaTreeCache;
}

export const bankBranchPageCrudConfig: CrudPageConfig = {
  apiBase: '/BankBranch',
  defaultFormValues: {
    enable: true,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  recordKey: 'bankBranchCode',
  permissionResourceName: '银行分支机构',
  permissionTypePrefix: '业务数据-',
  fields: [
    {
      key: 'bankBranchCode',
      label: '网点编号',
      disabledOnEdit: true,
      fixed: 'left',
      required: true,
      search: true,
      table: true,
      width: 150,
    },
    {
      key: 'containsBankBranchName',
      label: '网点名称',
      form: false,
      search: true,
    },
    { key: 'containsBankName', label: '银行名称', form: false, search: true },
    {
      key: 'bankBranchName',
      label: '网点名称',
      required: true,
      table: true,
      width: 180,
    },
    {
      key: 'oldBankBranchName',
      label: '网点曾用名称',
      table: true,
      width: 180,
    },
    {
      key: 'bankName',
      label: '银行名称',
      required: true,
      table: true,
      width: 180,
    },
    { key: 'bankSimpleName', label: '银行简称', table: true, width: 150 },
    {
      key: 'bankCode',
      label: '银行编码',
      required: true,
      table: true,
      width: 140,
    },
    { key: 'customBankCode', label: '自定义银行编码', table: true, width: 150 },
    {
      key: 'areaPath',
      areaCascader: {
        cityCodeKey: 'cityCode',
        cityNameKey: 'cityName',
        districtAdminCodeKey: 'districtAdminCode',
        districtCodeKey: 'districtCode',
        districtNameKey: 'districtName',
        provinceCodeKey: 'provinceCode',
        provinceNameKey: 'provinceName',
      },
      label: '省市区',
      layoutGroup: 'basic',
      loadOptions: bankBranchAreaOptionsLoader,
      required: true,
      search: true,
      type: 'area-cascader',
    },
    {
      key: 'provinceName',
      label: '省份名称',
      form: false,
      table: true,
      width: 120,
    },
    {
      key: 'cityName',
      label: '城市名称',
      form: false,
      table: true,
      width: 120,
    },
    {
      key: 'districtName',
      label: '区县名称',
      form: false,
      table: true,
      width: 120,
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
    { key: 'provinceCode', label: '省份编码', form: false },
    { key: 'cityCode', label: '城市编码', form: false },
    { key: 'districtCode', label: '区县编码', form: false },
    { key: 'districtAdminCode', label: '区县行政编码', form: false },
    {
      key: 'enable',
      label: '是否启用',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'createTime',
      label: '创建时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '银行分支机构管理',
};
