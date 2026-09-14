import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { urlExAclService } from '../../api/url-ex-acl-service';
import {
  authorizedControllerPathOptionsLoader,
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  roleOptionsLoader,
  tenantOptionsLoader,
  tenantSiteDomainOptionsLoader,
} from '../api-module';
import { normalizeNameValueRuleList } from '../traffic-control-rule/traffic-control-match';

const interceptTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.UrlExAcl$InterceptType',
);

const methodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'PATCH', value: 'PATCH' },
];

function transformUrlAclSubmit(values: Record<string, any>) {
  // 数值控件使用扁平键录入，保存时显式映射回扩展信息，保留其他扩展参数。
  const payload = { ...values };
  const bodyLimitKey = 'exInfo.maxRequestBodyBytes';
  if (
    payload.interceptType === 'RequestBodyLimit' &&
    Object.hasOwn(payload, bodyLimitKey)
  ) {
    payload.exInfo = {
      ...payload.exInfo,
      maxRequestBodyBytes: payload[bodyLimitKey],
    };
  }
  Reflect.deleteProperty(payload, bodyLimitKey);

  // 请求头与参数继续使用统一规则格式，其他访问控制类型保持原有提交语义。
  return {
    ...payload,
    headerRuleList: normalizeNameValueRuleList(values.headerRuleList),
    requestParamRuleList: normalizeNameValueRuleList(
      values.requestParamRuleList,
    ),
  };
}

export const pageMeta = {
  name: 'UrlExAcl',
  title: '访问控制',
  description: '维护 URL 访问控制规则。',
} as const;

export const urlExAclPageCrudConfig: CrudPageConfig = {
  apiBase: '/UrlExAcl',
  domainObject: true,
  apiService: urlExAclService,
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
    {
      key: 'tenantId',
      label: '归属租户',
      layoutGroup: 'basic',
      layoutGroupTitle: '规则信息',
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
      label: 'ACL ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'containsName',
      label: '名称',
      form: false,
      search: true,
    },
    {
      key: 'name',
      label: '名称',
      layoutGroup: 'basic',
      layoutOrder: 20,
      required: true,
      table: true,
      width: 180,
    },
    {
      key: 'pinyinName',
      label: '拼音名',
      layoutGroup: 'basic',
      layoutOrder: 30,
      table: true,
      width: 160,
    },
    {
      key: 'interceptType',
      label: '拦截类型',
      layoutGroup: 'basic',
      layoutOrder: 40,
      loadOptions: interceptTypeOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 120,
    },
    // 仅请求体限制使用本字段；其他类型不校验、不写入阈值。
    {
      key: 'exInfo.maxRequestBodyBytes',
      label: '请求体最大字节数',
      layoutGroup: 'basic',
      layoutOrder: 45,
      defaultValue: 1_048_576,
      type: 'number',
      valueType: 'number',
      help: '仅请求体大小限制类型生效，单位：字节，默认 1048576（1 MiB），超限返回 413，长度未知返回 411（无正文 GET 也不例外），建议仅匹配 POST/PUT/PATCH。支持 URL、方法、域名、IP、地区、操作系统和请求头，不支持用户类型、角色或请求参数条件。',
      validator(value, formState) {
        // 其他拦截类型不受请求体限制字段的校验影响。
        if (formState.interceptType !== 'RequestBodyLimit') return undefined;

        // 与服务端正整数约束一致，不允许用零或负数停用规则。
        if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
          return '请求体最大字节数必须为正整数';
        }
        return undefined;
      },
    },
    {
      key: 'containsInterceptor',
      label: '拦截器Bean名称',
      form: false,
      search: true,
    },
    {
      key: 'interceptor',
      label: '拦截器Bean名称',
      layoutGroup: 'basic',
      layoutOrder: 50,
      table: true,
      width: 220,
    },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'basic',
      layoutOrder: 60,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      layoutGroup: 'basic',
      layoutOrder: 70,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'urlPathList',
      label: 'URL包含列表',
      layoutGroup: 'content',
      layoutGroupTitle: 'URL与请求条件',
      layoutNewRow: true,
      layoutOrder: 10,
      help: '可搜索授权控制器路径填入，也可手动配置通配符数组；支持*和?，例如 /api/order/*、/api/order/??/detail。本字段内任一命中。',
      loadOptions: authorizedControllerPathOptionsLoader,
      remoteSearch: true,
      span: 2,
      type: 'tags',
    },
    {
      key: 'urlPathExcludeList',
      label: 'URL排除列表',
      layoutGroup: 'content',
      layoutOrder: 20,
      help: '可搜索授权控制器路径填入，也可手动配置通配符数组；支持*和?；命中任意排除规则时跳过当前访问控制规则。',
      loadOptions: authorizedControllerPathOptionsLoader,
      remoteSearch: true,
      span: 2,
      type: 'tags',
    },
    {
      key: 'methodList',
      label: '请求方法包含列表',
      layoutGroup: 'content',
      layoutOrder: 30,
      help: '支持*和?匹配，本字段内任一命中。',
      options: methodOptions,
      span: 2,
      type: 'tags',
    },
    {
      key: 'domainList',
      label: '域名包含列表',
      layoutGroup: 'content',
      layoutOrder: 40,
      help: '支持*和?匹配，本字段内任一命中。',
      loadOptions: tenantSiteDomainOptionsLoader,
      remoteSearch: true,
      span: 2,
      type: 'tags',
    },
    {
      key: 'regionList',
      label: '地区包含列表',
      layoutGroup: 'content',
      layoutOrder: 50,
      help: '支持*和?匹配，本字段内任一命中。',
      span: 2,
      type: 'tags',
    },
    {
      key: 'ipList',
      label: 'IP地址包含列表',
      layoutGroup: 'content',
      layoutOrder: 60,
      help: '支持*和?匹配，本字段内任一命中。',
      span: 2,
      type: 'tags',
    },
    {
      key: 'ipExcludeList',
      label: 'IP地址排除列表',
      layoutGroup: 'content',
      layoutOrder: 70,
      help: '支持*和?匹配；命中任意排除规则时跳过当前访问控制规则。',
      span: 2,
      type: 'tags',
    },
    {
      key: 'osList',
      label: '操作系统包含列表',
      layoutGroup: 'content',
      layoutOrder: 80,
      help: '支持*和?匹配，本字段内任一命中。',
      span: 2,
      type: 'tags',
    },
    {
      key: 'userTypeList',
      label: '用户类型包含列表',
      layoutGroup: 'content',
      layoutOrder: 90,
      help: '支持*和?匹配，本字段内任一命中；如果配置了用户类型，未登录请求会跳过当前规则。',
      span: 2,
      type: 'tags',
    },
    {
      key: 'userRoleList',
      label: '用户角色包含列表',
      layoutGroup: 'content',
      layoutOrder: 100,
      help: '支持*和?匹配，本字段内任一命中；如果配置了用户角色，未登录请求会跳过当前规则。',
      loadOptions: roleOptionsLoader,
      span: 2,
      remoteSearch: true,
      type: 'tags',
    },
    {
      key: 'requestParamRuleList',
      label: '请求参数匹配列表',
      layoutGroup: 'extension',
      layoutGroupTitle: '参数匹配条件',
      layoutNewRow: true,
      layoutOrder: 10,
      help: '每项使用未编码的name=value，必须且只能包含一个等号；名称和值支持*和?。示例：tenant*=ma?ket-*、status=*。',
      placeholder: '例如 tenant*=ma?ket-*',
      span: 2,
      type: 'tags',
    },
    {
      key: 'headerRuleList',
      label: '请求头匹配列表',
      layoutGroup: 'extension',
      layoutOrder: 20,
      help: '每项使用未编码的name=value，必须且只能包含一个等号；名称和值支持*和?。示例：X-Tenant-*=vip?、X-Client-App-Id=*。',
      placeholder: '例如 X-Tenant-*=vip?',
      span: 2,
      type: 'tags',
    },
    {
      key: 'exInfo',
      label: '扩展信息',
      layoutGroup: 'extension',
      layoutOrder: 30,
      type: 'json',
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
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
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '访问控制',
  transformSubmit: transformUrlAclSubmit,
};
