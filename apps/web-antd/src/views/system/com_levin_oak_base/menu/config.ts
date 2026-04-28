import type { CrudPageConfig } from '../../shared/types';

import { menuOptionsLoader, menuPageTypeOptionsLoader, tenantOptionsLoader } from '../api-module';

const menuActionTypeOptions = [
  { label: '默认', value: 'Default' },
  { label: '模态窗口', value: 'ModalWindow' },
  { label: 'Tab栏', value: 'TabPanel' },
  { label: '新浏览器窗口', value: 'NewWindow' },
  { label: '地址栏重定向', value: 'Redirect' },
  { label: '路径重写', value: 'Rewrite' },
  { label: 'jsonp回调', value: 'Jsonp' },
  { label: '服务端动作', value: 'ServerSideAction' },
];

export const menuPageCrudConfig: CrudPageConfig = {
  apiBase: '/Menu',
  allowRetrieve: true,
  defaultFormValues: {
    actionType: 'Default',
    alwaysShow: false,
    editable: true,
    enable: true,
    orderCode: 100,
    pageType: 'LocalPage',
  },
  defaultQuery: {
    loadParent: true,
    pageIndex: 1,
    pageSize: 10,
  },
  description: '菜单默认按当前租户可见数据维护，权限字段支持按行输入。',
  fields: [
    { key: 'tenantId', label: '归属租户', loadOptions: tenantOptionsLoader, remoteSearch: true, search: true, type: 'select', visibleForSaasUser: true },
    { key: '__tenant', label: '归属租户', fixed: 'left', form: false, table: true, type: 'tenant', visibleForSaasUser: true, width: 180 },
    { key: 'id', label: '菜单ID', fixed: 'left', form: false, search: true, table: true, width: 180 },
    { key: 'containsName', label: '菜单名称', form: false, search: true },
    { key: 'name', label: '菜单名称', required: true, table: true, width: 150 },
    { key: 'containsPath', label: '路径', form: false, search: true },
    { key: 'path', label: '路径', required: true, table: true, width: 220 },
    { key: 'parentId', label: '父菜单', loadOptions: menuOptionsLoader, remoteSearch: true, search: true, type: 'select' },
    { key: 'parent.name', label: '父菜单', form: false, table: true, width: 140 },
    { key: 'domain', label: '域名', search: true, table: true, width: 180 },
    { key: 'moduleId', label: '模块ID', search: true, table: true, width: 140 },
    { key: 'inPageType', label: '页面类型', form: false, loadOptions: menuPageTypeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'pageType', label: '页面类型', loadOptions: menuPageTypeOptionsLoader, required: true, table: true, type: 'select', width: 120 },
    { key: 'inActionType', label: '打开方式', form: false, multiple: true, options: menuActionTypeOptions, search: true, type: 'select' },
    { key: 'actionType', label: '打开方式', options: menuActionTypeOptions, table: true, type: 'select', width: 130 },
    { key: 'label', label: '菜单标签', table: true, width: 160 },
    { key: 'target', label: '目标', table: true, width: 120 },
    { key: 'icon', label: '图标', table: true, type: 'image', width: 90 },
    { key: 'requireAuthorizations', label: '所需权限', fullRow: true, placeholder: '一行一个权限或角色', table: true, type: 'string-array', width: 220 },
    { key: 'params', label: '参数', fullRow: true, type: 'textarea' },
    { key: 'alwaysShow', label: '无权限时是否展示', table: true, type: 'switch', valueType: 'boolean', width: 140 },
    { key: 'orderCode', label: '排序代码', type: 'number' },
    { key: 'enable', label: '是否启用', search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'editable', label: '是否可编辑', search: true, table: true, type: 'switch', valueType: 'boolean', width: 110 },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
    { key: 'lastUpdateTime', label: '更新时间', form: false, table: true, type: 'datetime', width: 180 },
    { key: 'remark', label: '备注', type: 'textarea' },
  ],
  modalWidth: 1120,
  title: '菜单管理',
};
