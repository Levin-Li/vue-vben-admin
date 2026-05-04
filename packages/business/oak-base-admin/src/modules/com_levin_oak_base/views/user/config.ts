import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import {
  moduleFetchDictOptions,
  moduleFetchEnumOptions,
  moduleFetchOptions,
  moduleGet,
  modulePut,
} from '../api-module';

function withOptionSearchParams(
  defaultParams: Record<string, any>,
  searchParamName = 'containsName',
  keyword?: string,
) {
  const params = { ...defaultParams };
  const normalizedKeyword = String(keyword || '').trim();

  if (normalizedKeyword) {
    params[searchParamName] = normalizedKeyword;
  }

  return params;
}

const roleOptionsLoader = (keyword?: string) =>
  moduleFetchOptions(
    '/Role/listUserRoleCode',
    'label',
    'value',
    withOptionSearchParams(
      {
        codeForKey: false,
        pageIndex: 1,
        pageSize: 500,
      },
      'containsName',
      keyword,
    ),
  );

const tenantOptionsLoader = (keyword?: string) =>
  moduleFetchOptions(
    '/Tenant/list',
    'name',
    'id',
    withOptionSearchParams(
      {
        pageIndex: 1,
        pageSize: 500,
      },
      'containsName',
      keyword,
    ),
  );

const userSexOptionsLoader = () =>
  moduleFetchEnumOptions('com.levin.oak.base.entities.User$Sex');

const userCategoryOptionsLoader = () =>
  moduleFetchEnumOptions('com.levin.oak.base.entities.User$Category');

const userStateOptionsLoader = () =>
  moduleFetchEnumOptions('com.levin.oak.base.entities.User$State');

const confidentialLevelOptionsLoader = () =>
  moduleFetchEnumOptions('com.levin.commons.rbac.ConfidentialLevel');

const userLevelOptionsLoader = () =>
  moduleFetchDictOptions('com.levin.oak.base.entities.User.level');

const userTypeOptionsLoader = () =>
  moduleFetchDictOptions('com.levin.oak.base.entities.User.type');

const jobPostOptionsLoader = (keyword?: string) =>
  moduleFetchOptions(
    '/JobPost/list',
    'name',
    'code',
    withOptionSearchParams(
      {
        enable: true,
        pageIndex: 1,
        pageSize: 500,
      },
      'containsName',
      keyword,
    ),
  );

const userOptionsLoader = (keyword?: string) =>
  moduleFetchOptions(
    '/User/list',
    'name',
    'id',
    withOptionSearchParams(
      {
        enable: true,
        pageIndex: 1,
        pageSize: 500,
      },
      'containsName',
      keyword,
    ),
  );

export const userPageCrudConfig: CrudPageConfig = {
  apiBase: '/User',
  allowRetrieve: true,
  defaultFormValues: {
    category: 'Staff',
    editable: true,
    enable: true,
    orderCode: 100,
    state: 'Normal',
  },
  defaultQuery: {
    loadJobPost: true,
    loadOrg: true,
    pageIndex: 1,
    pageSize: 10,
  },
  description:
    '页面字段、查询、操作按钮以 BizUserController/UserController 及用户 DTO 注解为准。',
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
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
      key: 'orgId',
      label: '所属组织',
      search: true,
      type: 'org-tree-select',
    },
    {
      key: 'orgName',
      label: '所属组织',
      fixed: 'left',
      form: false,
      table: true,
      width: 150,
    },
    {
      key: 'id',
      label: '用户ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    { key: 'containsName', label: '名称', form: false, search: true },
    { key: 'name', label: '名称', required: true, table: true, width: 140 },
    { key: 'containsTelephone', label: '手机号', form: false, search: true },
    { key: 'telephone', label: '手机号', table: true, width: 130 },
    { key: 'email', label: '邮箱', search: true, table: true, width: 180 },
    {
      key: 'loginName',
      label: '登录名',
      search: true,
      table: true,
      width: 140,
    },
    { key: 'containsNickname', label: '昵称', form: false, search: true },
    { key: 'nickname', label: '昵称', table: true, width: 120 },
    { key: 'containsStaffNo', label: '工号', form: false, search: true },
    { key: 'staffNo', label: '工号', table: true, width: 110 },
    {
      key: 'inType',
      label: '用户类型',
      form: false,
      loadOptions: userTypeOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'type',
      label: '用户类型',
      loadOptions: userTypeOptionsLoader,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'inCategory',
      label: '帐号类别',
      form: false,
      loadOptions: userCategoryOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'category',
      label: '帐号类别',
      loadOptions: userCategoryOptionsLoader,
      table: true,
      type: 'select',
      width: 130,
    },
    {
      key: 'inState',
      label: '帐号状态',
      form: false,
      loadOptions: userStateOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'state',
      label: '帐号状态',
      loadOptions: userStateOptionsLoader,
      table: true,
      type: 'select',
      width: 130,
    },
    {
      key: 'inSex',
      label: '性别',
      form: false,
      loadOptions: userSexOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'sex',
      label: '性别',
      loadOptions: userSexOptionsLoader,
      table: true,
      type: 'select',
      width: 90,
    },
    {
      key: 'inLevel',
      label: '用户等级',
      form: false,
      loadOptions: userLevelOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
      valueType: 'number',
    },
    {
      key: 'level',
      label: '用户等级',
      loadOptions: userLevelOptionsLoader,
      table: true,
      type: 'select',
      valueType: 'number',
      width: 120,
    },
    {
      key: 'jobPostCode',
      label: '岗位编码',
      loadOptions: jobPostOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
    },
    {
      key: 'jobPost.name',
      label: '岗位',
      form: false,
      table: true,
      width: 140,
    },
    {
      key: 'roleList',
      label: '角色编码列表',
      fullRow: true,
      loadOptions: roleOptionsLoader,
      multiple: true,
      remoteSearch: true,
      search: true,
      table: true,
      type: 'role-select',
      width: 180,
    },
    {
      key: 'gteBirthday',
      label: '出生日期开始',
      form: false,
      search: true,
      type: 'date',
    },
    {
      key: 'lteBirthday',
      label: '出生日期结束',
      form: false,
      search: true,
      type: 'date',
    },
    {
      key: 'birthday',
      label: '出生日期',
      table: true,
      type: 'date',
      width: 120,
    },
    {
      key: 'gteJoinDate',
      label: '加入时间开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteJoinDate',
      label: '加入时间结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'joinDate',
      label: '加入会员时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'gteExpiredTime',
      label: '到期时间开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteExpiredTime',
      label: '到期时间结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'expiredTime',
      label: '到期时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'gteLockExpiredTime',
      label: '锁定到期开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteLockExpiredTime',
      label: '锁定到期结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lockExpiredTime',
      label: '锁定到期时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'gteLastLoginTime',
      label: '最后登录开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteLastLoginTime',
      label: '最后登录结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lastLoginTime',
      label: '最后一次登录时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'containsTagList',
      label: '标签列表',
      form: false,
      search: true,
      type: 'string-array',
    },
    {
      key: 'tagList',
      label: '标签列表',
      fullRow: true,
      table: true,
      type: 'tags',
      width: 180,
    },
    {
      key: 'containsDomainList',
      label: '可登录域名列表',
      form: false,
      search: true,
      type: 'string-array',
    },
    {
      key: 'domainList',
      label: '可登录域名列表',
      fullRow: true,
      placeholder: '输入域名后回车，空值或空列表表示不限制',
      table: true,
      type: 'tags',
      width: 180,
    },
    {
      key: 'containsRegisterSource',
      label: '注册来源',
      form: false,
      search: true,
    },
    {
      key: 'registerSource',
      label: '注册来源',
      form: false,
      table: true,
      width: 160,
    },
    {
      key: 'containsRegisterIp',
      label: '注册IP',
      form: false,
      search: true,
    },
    {
      key: 'registerIp',
      label: '注册IP',
      form: false,
      table: true,
      width: 140,
    },
    {
      key: 'confidentialLevel',
      label: '机密等级',
      loadOptions: confidentialLevelOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'confidentialDataAccessLevel',
      label: '机密数据访问级别',
      loadOptions: confidentialLevelOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 160,
    },
    {
      key: 'avatar',
      label: '头像',
      table: true,
      type: 'image',
      width: 90,
    },
    {
      key: 'password',
      label: '登录密码',
      placeholder: '新增时设置初始密码；编辑时留空表示不修改',
      type: 'password',
    },
    {
      key: 'signature',
      label: '个性签名',
      type: 'textarea',
    },
    {
      key: 'pinyinName',
      label: '拼音名',
      placeholder: '简拼或全拼，逗号隔开',
    },
    {
      key: 'referrerId',
      label: '推荐人',
      loadOptions: userOptionsLoader,
      remoteSearch: true,
      type: 'select',
    },
    {
      key: 'referrerName',
      label: '推荐人姓名',
    },
    {
      key: 'wxOpenId',
      label: '微信OpendId',
    },
    {
      key: 'aliOpenId',
      label: '阿里OpendId',
    },
    {
      key: 'exInfo',
      label: '扩展信息',
      fullRow: true,
      type: 'json',
    },
    { key: 'orderCode', label: '排序代码', type: 'number' },
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
      key: 'editable',
      label: '是否可编辑',
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
      type: 'textarea',
    },
  ],
  modalWidth: 1120,
  rowActions: [
    {
      handler: async (record: Record<string, any>) =>
        moduleGet('/User/viewMfaQrCode', {
          params: {
            id: record.id,
          },
        }),
      label: 'MFA二维码',
      permission: [
        '/User/viewMfaQrCode',
        'com.levin.oak.base:系统数据-用户::MFA二维码',
      ],
      reloadAfterAction: false,
      successAction: 'showForm',
      successMessage: false,
    },
    {
      confirmText: '确认重置该用户的 MFA 密钥吗？旧密钥会立即失效。',
      danger: true,
      handler: async (record: Record<string, any>) =>
        modulePut(
          '/User/resetMfaSecretKey',
          {},
          {
            params: {
              forQrCode: true,
              id: record.id,
            },
          },
        ),
      label: '重置MFA密钥',
      permission: [
        '/User/resetMfaSecretKey',
        'com.levin.oak.base:系统数据-用户::重置MFA密钥',
      ],
      reloadAfterAction: false,
      successAction: 'showQrCode',
    },
  ],
  searchCollapsedCount: 4,
  title: '用户管理',
};
