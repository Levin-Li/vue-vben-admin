import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import {
  DEFAULT_CRUD_MODAL_WIDTH,
  buildEnumOptionsLoader,
  tenantOptionsLoader,
  userOptionsLoader,
} from '../api-module';

const userSexOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.User$Sex',
);

export const socialUserPageCrudConfig: CrudPageConfig = {
  apiBase: '/SocialUser',
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    { key: 'tenantId', label: '归属租户', loadOptions: tenantOptionsLoader, remoteSearch: true, search: true, type: 'select', visibleForSaasUser: true },
    { key: '__tenant', label: '归属租户', fixed: 'left', form: false, table: true, type: 'tenant', visibleForSaasUser: true, width: 180 },
    { key: 'id', label: '社交用户ID', fixed: 'left', form: false, search: true, table: true, width: 180 },
    { key: 'innerUserId', label: '内部用户', loadOptions: userOptionsLoader, remoteSearch: true, search: true, type: 'select' },
    { key: 'sourcePlatform', label: '来源平台', search: true, table: true, width: 140 },
    { key: 'uid', label: '第三方用户标识', table: true, width: 180 },
    { key: 'openId', label: 'OpenId', search: true, table: true, width: 180 },
    { key: 'unionId', label: 'UnionId', table: true, width: 180 },
    { key: 'username', label: '第三方用户名', table: true, width: 160 },
    { key: 'nickname', label: '昵称', search: true, table: true, width: 140 },
    { key: 'containsTelephone', label: '手机号', form: false, search: true },
    { key: 'telephone', label: '手机号', table: true, width: 140 },
    { key: 'email', label: '邮箱', search: true, table: true, width: 180 },
    { key: 'avatar', label: '头像', table: true, type: 'image', width: 120 },
    { key: 'location', label: '位置', table: true, width: 160 },
    { key: 'inSex', label: '性别', form: false, loadOptions: userSexOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'sex', label: '性别', loadOptions: userSexOptionsLoader, table: true, type: 'select', width: 100 },
    { key: 'registerSource', label: '注册来源', table: true, width: 140 },
    { key: 'exInfo', label: '扩展信息', fullRow: true, type: 'json' },
    { key: 'enable', label: '是否启用', search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'editable', label: '是否可编辑', search: true, table: true, type: 'switch', valueType: 'boolean', width: 110 },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
    { key: 'lastUpdateTime', label: '更新时间', form: false, table: true, type: 'datetime', width: 180 },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '社交用户管理',
};
