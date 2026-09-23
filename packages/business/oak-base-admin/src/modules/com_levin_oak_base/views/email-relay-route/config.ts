import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { emailRelayRouteService } from '../../api/email-relay-route-service';
import { domainOptionsLoader, tenantOptionsLoader } from '../api-module';

type RelayTarget = {
  endpoint?: string;
  type?: string;
};

const relayTargetJsonSchema = {
  items: {
    properties: {
      endpoint: { title: '地址', type: 'string' },
      type: {
        oneOf: [
          { const: 'email', title: '邮箱' },
          { const: 'mail-webhook', title: '完整邮件 Webhook' },
          { const: 'notify-webhook', title: '通知 Webhook' },
        ],
        title: '投递类型',
      },
    },
    required: ['type', 'endpoint'],
    type: 'object',
  },
  title: '投递目标',
  type: 'array',
} as const;

function normalizeTargets(value: unknown): string[] {
  // UI 使用可编辑的类型化行；持久化使用稳定的 type:endpoint 协议。
  if (!Array.isArray(value)) {
    throw new TypeError('投递目标必须是数组');
  }

  const targets = value.map((value) => {
    if (typeof value === 'string') return value.trim();
    const target = (value || {}) as RelayTarget;
    const type = String(target.type || '').trim().toLowerCase();
    const endpoint = String(target.endpoint || '').trim();
    if (!['email', 'mail-webhook', 'notify-webhook'].includes(type) || !endpoint) {
      throw new TypeError('每个投递目标都必须填写邮箱、完整邮件 Webhook 或通知 Webhook 类型及地址');
    }
    if (type === 'email' && !/^\S+@\S+\.\S+$/.test(endpoint)) {
      throw new TypeError('邮箱投递目标格式无效');
    }
    if (type !== 'email') {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) {
        throw new TypeError('Webhook 必须是没有用户信息的 HTTPS URL');
      }
    }
    return `${type}:${endpoint}`;
  });

  const valid = targets.filter(Boolean);
  if (!valid.length) throw new TypeError('至少需要一个投递目标');
  return valid;
}

export const pageMeta = {
  name: 'EmailRelayRoute',
  title: '邮件中转路由',
  description: '维护邮件中转路由。',
} as const;

export const emailRelayRoutePageCrudConfig: CrudPageConfig = {
  apiBase: '/EmailRelayRoute',
  domainObject: true,
  apiService: emailRelayRouteService,
  defaultFormValues: {
    editable: true,
    enable: true,
    localPart: 'support',
    orderCode: 100,
    syncStatus: 'Pending',
    targetList: [],
  },
  defaultQuery: { pageIndex: 1, pageSize: 10 },
  description:
    '将自定义域名邮件路由至一个或多个外部邮箱和 HTTPS Webhook。DNS 按 Forward Email 验证记录手动配置；Webhook 由 Forward Email 原生投递，按其 X-Webhook-Signature 和重试语义处理。',
  fields: [
    {
      key: 'tenantId',
      label: '所属租户',
      layoutGroup: 'basic',
      layoutGroupTitle: '路由配置',
      layoutOrder: 5,
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForPlatformUser: true,
    },
    {
      key: '__tenant',
      detail: false,
      label: '所属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
      width: 160,
    },
    {
      key: 'id',
      label: '路由ID',
      fixed: 'left',
      form: false,
      table: true,
      width: 160,
    },
    {
      key: 'name',
      label: '路由名称',
      layoutGroup: 'basic',
      layoutOrder: 10,
      required: true,
      search: true,
      table: true,
      width: 180,
    },
    { key: 'containsMailDomain', label: '邮件域名', form: false, search: true },
    {
      key: 'mailDomain',
      label: '邮件域名',
      layoutGroup: 'basic',
      layoutOrder: 20,
      required: true,
      allowInput: true,
      help: '可搜索并选择本系统已托管的根域名，也可手工输入外部域名；仅本地域名可自动同步 DNS。',
      loadOptions: domainOptionsLoader,
      remoteSearch: true,
      table: true,
      type: 'select',
      width: 240,
    },
    { key: 'containsLocalPart', label: '邮箱别名', form: false, search: true },
    {
      key: 'localPart',
      label: '邮箱别名',
      layoutGroup: 'basic',
      layoutOrder: 30,
      required: true,
      table: true,
      width: 150,
    },
    // 精确匹配例外：提供商为固定枚举选项，查询时按选中的完整编码过滤。
    {
      key: 'providerCode',
      label: '提供商',
      layoutGroup: 'basic',
      layoutOrder: 40,
      required: true,
      search: true,
      table: true,
      type: 'select',
      width: 210,
      options: [{ label: 'Forward Email', value: 'forward-email' }],
    },
    {
      key: 'syncStatus',
      label: '同步状态',
      layoutGroup: 'business',
      layoutGroupTitle: '同步与状态',
      layoutOrder: 10,
      search: true,
      table: true,
      type: 'select',
      width: 120,
      options: [
        { label: '待同步', value: 'Pending' },
        { label: '已同步', value: 'Synced' },
        { label: '失败', value: 'Failed' },
        { label: '已停用', value: 'Disabled' },
      ],
    },
    {
      key: 'targetList',
      label: '投递目标',
      fullRow: true,
      jsonSchema: relayTargetJsonSchema,
      jsonSchemaInline: true,
      layoutGroup: 'basic',
      layoutOrder: 50,
      type: 'json',
    },
    {
      key: 'lastSyncError',
      label: '最近同步错误',
      form: false,
      table: true,
      type: 'textarea',
      width: 240,
    },
    {
      key: 'lastSyncedTime',
      label: '最近同步时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
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
      key: 'remark',
      label: '备注',
      fullRow: true,
      layoutGroup: 'business',
      layoutOrder: 30,
      type: 'textarea',
    },
  ],
  modalWidth: 760,
  title: '邮件中转路由',
  transformSubmit: async (values) => {
    const nextValues = { ...values };
    nextValues.mailDomain = String(nextValues.mailDomain || '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');
    nextValues.localPart = String(nextValues.localPart || '')
      .trim()
      .toLowerCase();
    nextValues.name = String(
      nextValues.name || `${nextValues.localPart}@${nextValues.mailDomain}`,
    ).trim();
    nextValues.editable = true;
    nextValues.enable = nextValues.enable !== false;
    nextValues.orderCode = nextValues.orderCode ?? 100;
    nextValues.syncStatus = nextValues.syncStatus ?? 'Pending';
    nextValues.syncVersion = nextValues.syncVersion ?? 0;
    if (
      !nextValues.mailDomain ||
      !nextValues.localPart ||
      !nextValues.providerCode
    ) {
      throw new TypeError('请填写邮件域名、邮箱别名和提供商');
    }
    // 在保存前规范化目标列表，后端仍会执行最终校验和 SSRF 防护。
    nextValues.targetList = normalizeTargets(nextValues.targetList);
    return nextValues;
  },
};
