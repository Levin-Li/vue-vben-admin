import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { emailRelayRouteService } from '../../api/email-relay-route-service';
import { tenantOptionsLoader } from '../api-module';

export const emailRelayRoutePageCrudConfig: CrudPageConfig = {
  apiBase: '/EmailRelayRoute',
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
  description: '将自定义域名邮件路由至一个或多个外部邮箱和 HTTPS Webhook。DNS 按 Forward Email 验证记录手动配置；Webhook 由 Forward Email 原生投递，按其 X-Webhook-Signature 和重试语义处理。',
  fields: [
    { key: 'tenantId', label: '所属租户', loadOptions: tenantOptionsLoader, remoteSearch: true, search: true, type: 'select', visibleForPlatformUser: true },
    { key: '__tenant', label: '所属租户', fixed: 'left', form: false, table: true, type: 'tenant', visibleForPlatformUser: true, width: 160 },
    { key: 'id', label: '路由ID', fixed: 'left', form: false, table: true, width: 160 },
    { key: 'name', label: '路由名称', required: true, search: true, table: true, width: 180 },
    { key: 'mailDomain', label: '邮件域名', required: true, search: true, table: true, width: 240 },
    { key: 'localPart', label: '邮箱别名', required: true, search: true, table: true, width: 150 },
    {
      key: 'providerCode', label: '提供商', required: true, search: true, table: true, type: 'select', width: 210,
      options: [{ label: 'Forward Email', value: 'forward-email' }],
    },
    { key: 'syncStatus', label: '同步状态', form: false, search: true, table: true, type: 'select', width: 120,
      options: [{ label: '待同步', value: 'Pending' }, { label: '已同步', value: 'Synced' }, { label: '失败', value: 'Failed' }, { label: '已停用', value: 'Disabled' }] },
    { key: 'targetList', label: '投递目标', fullRow: true, type: 'json' },
    { key: 'lastSyncError', label: '最近同步错误', form: false, table: true, type: 'textarea', width: 240 },
    { key: 'lastSyncedTime', label: '最近同步时间', form: false, table: true, type: 'datetime', width: 180 },
    { key: 'enable', label: '是否启用', search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'remark', label: '备注', fullRow: true, type: 'textarea' },
  ],
  modalWidth: 760,
  title: '邮件中转路由',
  transformSubmit: async (values) => {
    const nextValues = { ...values };
    nextValues.mailDomain = String(nextValues.mailDomain || '').trim().toLowerCase().replace(/\.$/, '');
    nextValues.localPart = String(nextValues.localPart || '').trim().toLowerCase();
    nextValues.name = String(nextValues.name || `${nextValues.localPart}@${nextValues.mailDomain}`).trim();
    nextValues.editable = true;
    nextValues.enable = nextValues.enable !== false;
    nextValues.orderCode = nextValues.orderCode ?? 100;
    if (!nextValues.mailDomain || !nextValues.localPart || !nextValues.providerCode) {
      throw new TypeError('请填写邮件域名、邮箱别名和提供商');
    }
    return nextValues;
  },
};
