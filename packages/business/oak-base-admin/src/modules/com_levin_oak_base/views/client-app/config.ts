import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { clientAppService } from '../../api/client-app-service';
import {
  authorizedControllerPathOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  userOptionsLoader,
} from '../api-module';

function generateUuidPart(length: number) {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replaceAll('-', '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

  return randomPart.padEnd(length, randomPart).slice(0, length);
}

function generateClientAppId() {
  return `app_${generateUuidPart(16)}`;
}

function generateClientAppSecret() {
  return generateUuidPart(32);
}

function normalizePatternListValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue ? [trimmedValue] : [];
  }

  return [];
}

function transformClientAppSubmit(
  values: Record<string, any>,
  editingRecord: null | Record<string, any>,
) {
  const payload = {
    ...values,
    allowedIpList: normalizePatternListValue(values.allowedIpList),
    allowedPathPatterns: normalizePatternListValue(values.allowedPathPatterns),
  };

  if (editingRecord) {
    delete payload.appId;
    delete payload.appSignSecret;
    return payload;
  }

  if (!String(payload.appId || '').trim()) {
    payload.appId = generateClientAppId();
  }

  if (!String(payload.appSignSecret || '').trim()) {
    payload.appSignSecret = generateClientAppSecret();
  }

  return payload;
}

export const clientAppPageCrudConfig: CrudPageConfig = {
  apiBase: '/ClientApp',
  apiService: clientAppService,
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
    signType: 'HMAC_SHA256',
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      layoutGroup: 'ownership',
      layoutOrder: 10,
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForSaasUser: true,
    },
    {
      key: '__tenant',
      label: '归属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForSaasUser: true,
      width: 180,
    },
    {
      key: 'id',
      label: '记录ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'name',
      label: '应用名称',
      layoutGroup: 'basic',
      layoutOrder: 10,
      required: true,
      search: true,
      table: true,
      width: 160,
    },
    {
      key: 'appId',
      label: '应用ID',
      disabledOnEdit: true,
      formCreate: false,
      help: '新增时由前端自动生成，编辑时不允许修改。',
      layoutGroup: 'basic',
      layoutOrder: 20,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'serviceUserId',
      label: '绑定服务账号',
      layoutGroup: 'basic',
      layoutOrder: 30,
      loadOptions: userOptionsLoader,
      remoteSearch: true,
      required: true,
      search: true,
      table: true,
      type: 'select',
      width: 180,
    },
    {
      key: 'signType',
      label: '签名类型',
      layoutGroup: 'basic',
      layoutOrder: 40,
      options: [{ label: 'HMAC_SHA256', value: 'HMAC_SHA256' }],
      required: true,
      table: true,
      type: 'select',
      width: 130,
    },
    {
      key: 'expiredTime',
      label: '过期时间',
      layoutGroup: 'basic',
      layoutOrder: 50,
      search: true,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'appSignSecret',
      label: '签名密钥',
      disabledOnEdit: true,
      fullRow: true,
      help: '新增时由前端自动生成，编辑时不允许修改。',
      layoutGroup: 'basic',
      layoutNewRow: true,
      layoutOrder: 60,
      type: 'password',
    },
    {
      key: 'allowedPathPatterns',
      label: '允许访问路径',
      fullRow: true,
      help: '可搜索授权控制器URL路径填入，也可手动配置通配符路径；支持*和?，例如 /api/order/*、/api/order/??/detail。',
      layoutGroup: 'content',
      layoutNewRow: true,
      layoutOrder: 10,
      loadOptions: authorizedControllerPathOptionsLoader,
      remoteSearch: true,
      required: true,
      type: 'tags',
    },
    {
      key: 'allowedIpList',
      label: '允许访问IP',
      fullRow: true,
      help: '支持*和?通配匹配，例如 10.0.?.*；空表示不限制。',
      layoutGroup: 'content',
      layoutOrder: 20,
      type: 'tags',
    },
    {
      key: 'exInfo',
      label: '扩展信息',
      layoutGroup: 'extension',
      layoutNewRow: true,
      layoutOrder: 10,
      type: 'json',
    },
    {
      key: 'orderCode',
      label: '排序代码',
      layoutGroup: 'business',
      layoutOrder: 10,
      type: 'number',
    },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'business',
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
      layoutGroup: 'business',
      layoutOrder: 30,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
      layoutGroup: 'remark',
      layoutOrder: 10,
      type: 'textarea',
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
      key: 'lastAccessTime',
      label: '最后访问时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '客户端应用管理',
  transformSubmit: transformClientAppSubmit,
};
