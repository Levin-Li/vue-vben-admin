import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { tenantCustomMenuService } from '../../api/tenant-custom-menu-service';
import { DEFAULT_CRUD_MODAL_WIDTH, tenantOptionsLoader } from '../api-module';

export const tenantCustomMenuPageCrudConfig: CrudPageConfig = {
  apiBase: '/TenantCustomMenu',
  apiService: tenantCustomMenuService,
  defaultFormValues: { editable: true, enable: true, itemList: [], orderCode: 1000 },
  defaultQuery: { pageIndex: 1, pageSize: 10 },
  fields: [
    { key: 'tenantId', label: '归属租户', loadOptions: tenantOptionsLoader, remoteSearch: true, search: true, type: 'select', visibleForPlatformUser: true },
    { key: '__tenant', label: '归属租户', fixed: 'left', form: false, table: true, type: 'tenant', visibleForPlatformUser: true, width: 180 },
    { key: 'id', label: '布局ID', fixed: 'left', form: false, search: true, table: true, width: 180 },
    { key: 'containsName', label: '名称', form: false, search: true },
    { key: 'name', label: '名称', required: true, table: true, width: 180 },
    { key: 'domain', label: '域名', placeholder: '留空表示租户公共菜单', search: true, table: true, type: 'input', width: 220 },
    { key: 'itemList', form: false, label: '菜单列表', type: 'json' },
    { key: 'orderCode', label: '排序代码', table: true, type: 'number', width: 110 },
    { key: 'enable', label: '是否启用', search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'editable', label: '是否可编辑', table: true, type: 'switch', valueType: 'boolean', width: 110 },
    { key: 'remark', label: '备注', type: 'textarea' },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
    { key: 'lastUpdateTime', label: '更新时间', form: false, table: true, type: 'datetime', width: 180 },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '租户自定义菜单',
};
