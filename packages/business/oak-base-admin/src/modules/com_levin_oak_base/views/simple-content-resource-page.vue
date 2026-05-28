<script lang="ts" setup>
import type { PermissionTreeNode } from '@levin/admin-framework/framework-commons/shared/data-permission-types';
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import type {
  SimpleContentEditorMeta,
  SimpleContentResourceKind,
  SimpleContentResourceService,
} from './simple-content-resource';

import { computed, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { requestClient } from '@levin/admin-framework';
import {
  Button,
  Checkbox,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Tabs,
  message,
} from 'ant-design-vue';

import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import CodeEditorField from '@levin/admin-framework/framework-commons/shared/code-editor-field.vue';
import { buildCrudOperationPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { evaluateCrudVisibleOn } from '@levin/admin-framework/framework-commons/shared/crud-visible-on';
import { PermissionTreeNodeType } from '@levin/admin-framework/framework-commons/shared/data-permission-types';
import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import ResourcePermissionTreeEditor from '@levin/admin-framework/framework-commons/shared/resource-permission-tree-editor.vue';
import { isTopSuperAdminUser } from '@levin/admin-framework/framework-commons/shared/user-identity';

import { userService } from '../api/user-service';
import CrudPage from './crud-page.vue';
import {
  getRequireAuthorizationCount,
  normalizePermissionValues,
} from './simple-content-permissions';
import {
  normalizeSimpleDetailRecord,
  parseSimpleContentValue,
  resolveSimpleContentEditorMeta,
  serializeSimpleContentValue,
  withSimpleManagedSubmit,
} from './simple-content-resource';

type GenericRecord = Record<string, any>;
type ReloadList = () => Promise<any> | void;
type ScriptParamDefinition = {
  defaultValue?: string;
  description?: string;
  enumText?: string;
  in?: string;
  maxLength?: number;
  maximum?: number;
  minLength?: number;
  minimum?: number;
  name: string;
  pattern?: string;
  required?: boolean;
  type: string;
};

const props = defineProps<{
  config: CrudPageConfig;
  resourceKind: SimpleContentResourceKind;
  service: SimpleContentResourceService;
}>();

const userStore = useUserStore();
const { hasPermission } = useRbacAccess();

const managedConfig = computed(() => withSimpleManagedSubmit(props.config));
const contentOpen = ref(false);
const contentLoading = ref(false);
const contentSubmitting = ref(false);
const contentRecord = ref<GenericRecord | null>(null);
const contentEditorMeta = ref<SimpleContentEditorMeta>({
  kind: 'textarea',
  language: 'text',
  title: '文本',
});
const contentValue = ref<any>('');
const contentReload = ref<ReloadList | null>(null);
const scriptTestBodyText = ref('{}');
const scriptTestHeadersText = ref(toPrettyJson(getDefaultScriptHeaders()));
const scriptTestLoading = ref(false);
const scriptTestMethod = ref('POST');
const scriptTestPathVariablesText = ref('{}');
const scriptTestPath = ref('');
const scriptTestQueryText = ref('{}');
const scriptTestRequestSchemaText = ref('{}');
const scriptTestResult = ref('');
const scriptTestResponseSchemaText = ref('{}');
const scriptTestInputOpen = ref(false);
const scriptTestParamValues = ref<Record<string, string>>({});
const scriptMockLoginUserId = ref<string>();
const scriptMockUserLoading = ref(false);
const scriptMockUserOptions = ref<{ label: string; value: string }[]>([]);
const scriptRequestParams = ref<ScriptParamDefinition[]>([]);
const scriptResponseParams = ref<ScriptParamDefinition[]>([]);
const scriptTestTimeoutMs = ref(3000);
const scriptEditorTab = ref('code');
const scriptWorkbenchTab = ref('input');
const scriptTestMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
];
const SIMPLE_API_TEST_MODE_PARAM = '_simpleApiTestMode';
const SIMPLE_API_TEST_ID_PARAM = '_simpleApiTestId';
const SIMPLE_API_MOCK_LOGIN_USER_PARAM = '_simpleApiMockLoginUserId';
const SIMPLE_API_TEST_MODE_HEADER = 'X-Simple-Api-Test-Mode';
const SIMPLE_API_TEST_ID_HEADER = 'X-Simple-Api-Test-Id';
const SIMPLE_API_MOCK_LOGIN_USER_HEADER = 'X-Simple-Api-Mock-Login-User-Id';
const scriptParamInOptions = [
  { label: '查询参数/表单 Query', value: 'query' },
  { label: '请求头 Header', value: 'header' },
  { label: '路径变量 Path', value: 'path' },
  { label: '请求体 Body', value: 'body' },
];
const scriptParamTypeOptions = [
  { label: 'string', value: 'string' },
  { label: 'number', value: 'number' },
  { label: 'integer', value: 'integer' },
  { label: 'boolean', value: 'boolean' },
  { label: 'object', value: 'object' },
  { label: 'array', value: 'array' },
];
const scriptVariableGroups = [
  {
    title: '请求变量',
    items: [
      '_ctx.header',
      '_ctx.query',
      '_ctx.path',
      '_ctx.body',
      '_reqParams',
    ],
  },
  {
    title: '运行上下文',
    items: [
      '_ctx.method',
      '_ctx.urlPath',
      '_ctx.setting',
      '_ctx.request',
      '_ctx.response',
    ],
  },
  {
    title: '登录与租户',
    items: [
      '_ctx.tenant',
      '_ctx.tenantId',
      '_ctx.loginUser',
      '_ctx.operatorId',
      '_ctx.operatorName',
      '_ctx.isLogin',
    ],
  },
  {
    title: 'Spring',
    items: [
      "_spring.get('beanName')",
      '_spring.byTypeName("className")',
      '_spring.names()',
    ],
  },
  {
    title: '响应',
    items: ['return 返回值', '_ctx.result'],
  },
];
const scriptHelpSections = [
  {
    title: '脚本入口',
    items: [
      '简单接口只支持 Groovy。脚本会直接执行，不需要定义入口方法。',
      '脚本运行时只注入 _ctx、_reqParams、_spring 三类入口，不再注入历史别名。',
      '_spring 是 Spring Bean 访问器，可通过 _spring.get("beanName") 或 _spring.byTypeName("className") 获取 Bean。',
    ],
  },
  {
    title: '请求变量',
    items: [
      '_ctx.header、_ctx.query 都是 fastjson2.JSONObject，支持 _ctx.header.token 这类属性访问。',
      '_ctx.path 是路径变量，_ctx.body 是请求体；JSON Content-Type 下 body 会解析为 fastjson2.JSONObject。',
      '_reqParams 会按 header、query/form、path、body 顺序聚合，后面的来源覆盖前面的同名字段。',
    ],
  },
  {
    title: '登录与租户',
    items: [
      '_ctx.tenant 是当前租户；_ctx.loginUser 是当前登录用户，未登录时可能为空。',
      '在线测试可以选择模拟登录用户；不选择时使用当前登录态，未登录环境下 _ctx.loginUser 为空。',
    ],
  },
  {
    title: '参数校验',
    items: [
      '入参定义会生成请求校验契约，来源可选 query/form、header、path、body。',
      '出参定义会生成响应校验契约，脚本返回值不满足契约时测试结果会显示 validationErrors。',
      '需要更复杂规则时，可直接编辑入参契约和出参契约 JSON。',
    ],
  },
  {
    title: '响应返回',
    items: [
      '脚本 return 的对象就是接口响应体，通常返回 Map、List、String 或业务对象。',
      '如果脚本没有 return，可以设置 _ctx.result，平台会把它作为响应体兜底返回。',
      'HTTP 状态码和响应头通过 _ctx.response 设置，例如 _ctx.response.status = 201。',
    ],
  },
];
const scriptHelpExample = `def userName = _reqParams.userName
def orderService = _spring.get('orderService')

_ctx.response.setHeader('X-Simple-Api', 'true')

return [
  success: true,
  userName: userName,
  tenantId: _ctx.tenant?.id,
  loginUserId: _ctx.loginUser?.id
]`;
const permissionTree = ref<PermissionTreeNode[]>([]);
const permissionLoading = ref(false);
const permissionOpen = ref(false);
const permissionRecord = ref<GenericRecord | null>(null);
const permissionSelection = ref<string[]>([]);
const permissionSubmitting = ref(false);
const permissionReload = ref<ReloadList | null>(null);

const updatePermissions = computed(
  () =>
    props.config.editPermission ||
    (props.config.updatePath
      ? [
          props.config.updatePath,
          ...buildCrudOperationPermissions(props.config, 'update'),
        ]
      : buildCrudOperationPermissions(props.config, 'update')),
);
const contentModalTitle = computed(() =>
  contentRecord.value
    ? `${getContentEditorActionText()} - ${getRecordTitle(contentRecord.value)}`
    : getContentEditorActionText(),
);
const permissionModalTitle = computed(() =>
  permissionRecord.value
    ? `所需权限 - ${getRecordTitle(permissionRecord.value)}`
    : '所需权限',
);
const canShowScriptTestPanel = computed(
  () =>
    props.resourceKind === 'api' &&
    contentEditorMeta.value.kind === 'code' &&
    isTopSuperAdminUser(userStore.userInfo),
);

function getRecordTitle(record: GenericRecord) {
  return String(record.name || record.title || record.id || '当前记录').trim();
}

function getContentEditorActionText() {
  return props.resourceKind === 'api' ? '接口开发' : '编辑内容';
}

function getRecordId(record: GenericRecord) {
  return record[props.config.recordKey || 'id'] || record.id;
}

function getRecordMethod(record: GenericRecord) {
  const methods = String(record.methods || 'POST')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  return methods[0] || 'POST';
}

function toPrettyJson(value: any) {
  return JSON.stringify(value ?? {}, null, 2);
}

function getDefaultScriptHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

function toEditorText(value: any) {
  if (value === undefined || value === null) {
    return '';
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
}

function formatScriptConsoleValue(value: any) {
  if (!value || typeof value !== 'object' || !('success' in value)) {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }

  if (value.success !== false) {
    return [
      `SUCCESS ${value.durationMs ?? 0}ms`,
      JSON.stringify(value.result ?? null, null, 2),
    ].join('\n');
  }

  const lines = [
    `ERROR ${value.durationMs ?? 0}ms`,
    `${value.errorType || 'Error'}: ${value.errorMessage || ''}`.trim(),
  ];

  if (Array.isArray(value.validationErrors) && value.validationErrors.length > 0) {
    lines.push('', 'Validation errors:');
    value.validationErrors.forEach((item: string) => lines.push(`  ${item}`));
  }

  if (value.errorStackTrace) {
    lines.push('', value.errorStackTrace);
  } else {
    lines.push('', JSON.stringify(value, null, 2));
  }

  return lines.join('\n');
}

function appendScriptConsole(value: any) {
  const text = formatScriptConsoleValue(value);
  const time = new Date().toLocaleTimeString();
  const entry = `[${time}]\n${text}`;
  scriptTestResult.value = scriptTestResult.value
    ? `${scriptTestResult.value}\n\n${entry}`
    : entry;
}

function clearScriptConsole() {
  scriptTestResult.value = '';
}

function parseSettingObject(value: any) {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  return typeof value === 'object' ? { ...value } : {};
}

function getDefaultRequestSchema() {
  return {
    headers: {
      type: 'object',
      properties: {},
    },
    query: {
      type: 'object',
      properties: {},
    },
    pathVariables: {
      type: 'object',
      properties: {},
    },
    body: {
      type: 'object',
      properties: {},
    },
  };
}

function getDefaultResponseSchema() {
  return {
    type: 'object',
    properties: {},
  };
}

function normalizeScriptParam(
  value: any,
  fallbackIn?: string,
): ScriptParamDefinition {
  return {
    name: String(value?.name || ''),
    in: normalizeScriptParamIn(value?.in || fallbackIn),
    type: String(value?.type || 'string'),
    required: Boolean(value?.required),
    defaultValue: toEditorText(value?.default),
    enumText: Array.isArray(value?.enum)
      ? value.enum.join(', ')
      : toEditorText(value?.enum),
    pattern: value?.pattern ? String(value.pattern) : '',
    minimum: value?.minimum ?? value?.min,
    maximum: value?.maximum ?? value?.max,
    minLength: value?.minLength,
    maxLength: value?.maxLength,
    description: value?.description ? String(value.description) : '',
  };
}

function normalizeScriptParamIn(value: any) {
  const text = String(value || 'query')
    .trim()
    .toLowerCase();

  if (['head', 'header', 'headers'].includes(text)) {
    return 'header';
  }
  if (['path', 'pathvariable', 'pathvariables'].includes(text)) {
    return 'path';
  }
  if (['body', 'requestbody'].includes(text)) {
    return 'body';
  }
  if (
    ['form', 'param', 'params', 'query', 'queryparam', 'queryparams'].includes(
      text,
    )
  ) {
    return 'query';
  }

  return 'query';
}

function getScriptParamInLabel(value?: string) {
  return (
    scriptParamInOptions.find((item) => item.value === normalizeScriptParamIn(value))
      ?.label || '查询参数/表单 Query'
  );
}

function createRequestParam(): ScriptParamDefinition {
  return normalizeScriptParam({ in: 'query' });
}

function createResponseParam(): ScriptParamDefinition {
  return normalizeScriptParam({});
}

function parseMaybeJsonText(text?: string) {
  const value = (text || '').trim();

  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseEnumText(text?: string) {
  const value = (text || '').trim();

  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function serializeScriptParam(param: ScriptParamDefinition, includeIn: boolean) {
  const name = param.name.trim();

  if (!name) {
    return null;
  }

  const result: Record<string, any> = {
    name,
    type: param.type || 'string',
  };

  if (includeIn) {
    result.in = normalizeScriptParamIn(param.in);
  }

  if (param.required) {
    result.required = true;
  }

  const defaultValue = parseMaybeJsonText(param.defaultValue);
  if (defaultValue !== undefined) {
    result.default = defaultValue;
  }

  const enumValue = parseEnumText(param.enumText);
  if (enumValue !== undefined) {
    result.enum = enumValue;
  }

  if (param.pattern) {
    result.pattern = param.pattern;
  }
  if (param.minimum !== undefined && param.minimum !== null) {
    result.minimum = param.minimum;
  }
  if (param.maximum !== undefined && param.maximum !== null) {
    result.maximum = param.maximum;
  }
  if (param.minLength !== undefined && param.minLength !== null) {
    result.minLength = param.minLength;
  }
  if (param.maxLength !== undefined && param.maxLength !== null) {
    result.maxLength = param.maxLength;
  }
  if (param.description) {
    result.description = param.description;
  }

  return result;
}

function createObjectSchema() {
  return {
    type: 'object',
    properties: {} as Record<string, any>,
    required: [] as string[],
  };
}

function addParamToSchema(
  schema: ReturnType<typeof createObjectSchema>,
  param: Record<string, any>,
) {
  const fieldSchema: Record<string, any> = {
    type: param.type || 'string',
  };

  [
    'default',
    'enum',
    'pattern',
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
  ].forEach((key) => {
    if (param[key] !== undefined && param[key] !== null) {
      fieldSchema[key] = param[key];
    }
  });

  schema.properties[param.name] = fieldSchema;

  if (param.required && !schema.required.includes(param.name)) {
    schema.required.push(param.name);
  }
}

function buildRequestSchemaFromParams(params: Record<string, any>[]) {
  const schema = {
    headers: createObjectSchema(),
    query: createObjectSchema(),
    pathVariables: createObjectSchema(),
    body: createObjectSchema(),
  };

  params.forEach((param) => {
    const position = normalizeScriptParamIn(param.in);
    if (position === 'header') {
      addParamToSchema(schema.headers, param);
    } else if (position === 'path') {
      addParamToSchema(schema.pathVariables, param);
    } else if (position === 'body') {
      addParamToSchema(schema.body, param);
    } else {
      addParamToSchema(schema.query, param);
    }
  });

  return schema;
}

function buildResponseSchemaFromParams(params: Record<string, any>[]) {
  const schema = createObjectSchema();

  params.forEach((param) => addParamToSchema(schema, param));

  return schema;
}

function addRequestParam() {
  scriptRequestParams.value.push(createRequestParam());
}

function removeRequestParam(index: number) {
  scriptRequestParams.value.splice(index, 1);
}

function addResponseParam() {
  scriptResponseParams.value.push(createResponseParam());
}

function removeResponseParam(index: number) {
  scriptResponseParams.value.splice(index, 1);
}

function getScriptParamKey(param: ScriptParamDefinition) {
  return `${normalizeScriptParamIn(param.in)}:${param.name || ''}`;
}

function getScriptParamValueSource(param: ScriptParamDefinition, example: any) {
  const name = param.name;
  if (!name) {
    return undefined;
  }

  const position = normalizeScriptParamIn(param.in);

  if (position === 'header') {
    return example.headers?.[name];
  }
  if (position === 'path') {
    return example.pathVariables?.[name];
  }
  if (position === 'body') {
    return example.body?.[name];
  }
  return example.query?.[name];
}

function formatScriptTestParamValue(param: ScriptParamDefinition, value: any) {
  if (value !== undefined && value !== null) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  return param.defaultValue || '';
}

function syncScriptTestParamValues(example: any = {}) {
  const values: Record<string, string> = {};

  scriptRequestParams.value.forEach((param) => {
    const key = getScriptParamKey(param);
    values[key] = formatScriptTestParamValue(
      param,
      getScriptParamValueSource(param, example),
    );
  });

  scriptTestParamValues.value = values;
}

function parseScriptTestParamValue(text: string, param: ScriptParamDefinition) {
  const value = text.trim();

  if (!value) {
    return undefined;
  }

  if (param.type === 'string') {
    return value;
  }

  if (param.type === 'boolean') {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }

  if (param.type === 'number' || param.type === 'integer') {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? value : numberValue;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function applyScriptTestParamValues(
  headers: Record<string, any>,
  query: Record<string, any>,
  pathVariables: Record<string, any>,
  body: any,
) {
  if (scriptRequestParams.value.length === 0) {
    return { body, headers, pathVariables, query };
  }

  const nextHeaders = { ...headers };
  const nextQuery = { ...query };
  const nextPathVariables = { ...pathVariables };
  const nextBody =
    body && typeof body === 'object' && !Array.isArray(body) ? { ...body } : {};

  scriptRequestParams.value.forEach((param) => {
    const name = param.name.trim();
    if (!name) {
      return;
    }

    const value = parseScriptTestParamValue(
      scriptTestParamValues.value[getScriptParamKey(param)] || '',
      param,
    );

    if (value === undefined) {
      return;
    }

    const position = normalizeScriptParamIn(param.in);

    if (position === 'header') {
      nextHeaders[name] = value;
    } else if (position === 'path') {
      nextPathVariables[name] = value;
    } else if (position === 'body') {
      nextBody[name] = value;
    } else {
      nextQuery[name] = value;
    }
  });

  scriptTestHeadersText.value = toPrettyJson(nextHeaders);
  scriptTestQueryText.value = toPrettyJson(nextQuery);
  scriptTestPathVariablesText.value = toPrettyJson(nextPathVariables);
  scriptTestBodyText.value = toPrettyJson(nextBody);

  return {
    body: nextBody,
    headers: nextHeaders,
    pathVariables: nextPathVariables,
    query: nextQuery,
  };
}

function openScriptTestInputDialog() {
  try {
    syncScriptTestParamValues({
      body: parseJsonInput(scriptTestBodyText.value, {}),
      headers: parseJsonInput(scriptTestHeadersText.value, {}),
      pathVariables: parseJsonInput(scriptTestPathVariablesText.value, {}),
      query: parseJsonInput(scriptTestQueryText.value, {}),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : error;
    scriptWorkbenchTab.value = 'result';
    appendScriptConsole({
      success: false,
      errorType: 'ParameterParseException',
      errorMessage: `测试参数JSON格式不正确：${reason}`,
      errorStackTrace: error instanceof Error ? error.stack : undefined,
      debugInfo: {
        method: scriptTestMethod.value,
        mockLoginUserId: scriptMockLoginUserId.value,
        path: scriptTestPath.value,
      },
    });
    message.error(`测试参数JSON格式不正确：${reason}`);
    return;
  }
  scriptTestInputOpen.value = true;
  void loadScriptMockUserOptions();
}

function closeScriptTestInputDialog() {
  scriptTestInputOpen.value = false;
}

function normalizeUserListResult(result: any) {
  if (Array.isArray(result)) {
    return result;
  }
  if (Array.isArray(result?.items)) {
    return result.items;
  }
  if (Array.isArray(result?.list)) {
    return result.list;
  }
  if (Array.isArray(result?.records)) {
    return result.records;
  }
  if (Array.isArray(result?.data)) {
    return result.data;
  }
  return [];
}

async function loadScriptMockUserOptions(keyword = '') {
  scriptMockUserLoading.value = true;
  try {
    const result = await userService.list({
      pageIndex: 1,
      pageSize: 20,
      ...(keyword ? { containsName: keyword } : {}),
    });
    scriptMockUserOptions.value = normalizeUserListResult(result).map(
      (item: any) => ({
        label: `${item.name || item.nickname || item.loginName || item.id}`,
        value: item.id,
      }),
    );
  } catch (error) {
    console.error(error);
    message.error('加载模拟用户失败');
  } finally {
    scriptMockUserLoading.value = false;
  }
}

function initScriptWorkbench(record: GenericRecord) {
  const setting = parseSettingObject(record.setting);
  const firstExample = Array.isArray(setting.examples)
    ? setting.examples[0] || {}
    : {};

  scriptTestBodyText.value = toPrettyJson(firstExample.body || {});
  scriptTestHeadersText.value = toPrettyJson(
    firstExample.headers || getDefaultScriptHeaders(),
  );
  scriptTestMethod.value = String(firstExample.method || getRecordMethod(record));
  scriptTestPath.value = String(firstExample.path || record.path || '');
  scriptTestPathVariablesText.value = toPrettyJson(
    firstExample.pathVariables || {},
  );
  scriptTestQueryText.value = toPrettyJson(firstExample.query || {});
  scriptTestRequestSchemaText.value = toPrettyJson(
    setting.requestSchema || getDefaultRequestSchema(),
  );
  scriptTestResponseSchemaText.value = toPrettyJson(
    setting.responseSchema || getDefaultResponseSchema(),
  );
  scriptRequestParams.value = Array.isArray(setting.requestParams)
    ? setting.requestParams.map((item: any) => normalizeScriptParam(item, 'query'))
    : [];
  scriptResponseParams.value = Array.isArray(setting.responseParams)
    ? setting.responseParams.map((item: any) => normalizeScriptParam(item))
    : [];
  syncScriptTestParamValues(firstExample);
  scriptMockLoginUserId.value = undefined;
  scriptTestInputOpen.value = false;
  scriptTestTimeoutMs.value = Number(setting.timeoutMs || 3000);
  scriptEditorTab.value = 'code';
  scriptWorkbenchTab.value = 'input';
}

function getSupportEventsByCurrentStatus(record: GenericRecord) {
  const events = record.supportEventsByCurrentStatus;
  return Array.isArray(events)
    ? events.filter((event): event is string => typeof event === 'string')
    : undefined;
}

function canUseEditStatusEvent(record: GenericRecord) {
  const events = getSupportEventsByCurrentStatus(record);
  return events === undefined || events.includes('编辑');
}

function canShowManagedActions(record: GenericRecord) {
  return (
    props.config.allowEdit !== false &&
    hasPermission(updatePermissions.value) &&
    canUseEditStatusEvent(record) &&
    evaluateCrudVisibleOn(
      props.config.editVisibleOn,
      record,
      userStore.userInfo,
    )
  );
}

async function retrieveFreshRecord(record: GenericRecord) {
  if (!props.service.retrieve || !getRecordId(record)) {
    return record;
  }

  const detail = await props.service.retrieve({
    [props.config.recordKey || 'id']: getRecordId(record),
    id: getRecordId(record),
  });

  return {
    ...record,
    ...normalizeSimpleDetailRecord(detail),
  };
}

async function retrieveFreshRecordContent(record: GenericRecord) {
  if (!props.service.retrieveContent || !getRecordId(record)) {
    return record;
  }

  const contentResult = await props.service.retrieveContent({
    [props.config.recordKey || 'id']: getRecordId(record),
    id: getRecordId(record),
  });
  const contentData = normalizeSimpleDetailRecord(contentResult);

  return {
    ...record,
    ...(contentData && typeof contentData === 'object' ? contentData : {}),
  };
}

async function openContentEditor(record: GenericRecord, reload?: ReloadList) {
  if (!canShowManagedActions(record)) {
    message.warning('当前账号没有编辑权限');
    return;
  }

  contentLoading.value = true;
  contentOpen.value = true;
  contentReload.value = reload || null;

  try {
    const freshRecord = await retrieveFreshRecordContent(
      await retrieveFreshRecord(record),
    );
    const meta = resolveSimpleContentEditorMeta(
      props.resourceKind,
      freshRecord,
    );

    contentRecord.value = freshRecord;
    contentEditorMeta.value = meta;
    contentValue.value = parseSimpleContentValue(meta, freshRecord.content);
    initScriptWorkbench(freshRecord);
  } catch (error) {
    contentOpen.value = false;
    console.error(error);
    message.error('加载内容失败');
  } finally {
    contentLoading.value = false;
  }
}

function closeContentEditor() {
  contentOpen.value = false;
  contentRecord.value = null;
  contentValue.value = '';
  contentReload.value = null;
  scriptTestResult.value = '';
}

async function submitContent() {
  const record = contentRecord.value;

  if (!record?.id || !props.service.update) {
    message.warning('未找到可更新的记录');
    return;
  }

  contentSubmitting.value = true;

  try {
    const payload: Record<string, any> = {
      forceUpdateFields: ['content'],
      id: record.id,
      optimisticLock: record.optimisticLock,
      content: serializeSimpleContentValue(
        contentEditorMeta.value,
        contentValue.value,
      ),
    };

    if (canShowScriptTestPanel.value) {
      const setting = buildScriptSetting(record);
      payload.forceUpdateFields = ['content', 'methods', 'path', 'setting'];
      payload.methods = scriptTestMethod.value;
      payload.path = scriptTestPath.value;
      payload.setting = setting;
    }

    await props.service.update(payload);
    message.success('内容已更新');
    const reload = contentReload.value;
    closeContentEditor();
    await reload?.();
  } catch (error) {
    console.error(error);
    message.error('内容更新失败');
  } finally {
    contentSubmitting.value = false;
  }
}

function parseJsonInput(text: string, defaultValue: any) {
  const value = text.trim();

  if (!value) {
    return defaultValue;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'JSON格式不正确',
    );
  }
}

function buildScriptSetting(record: GenericRecord) {
  const setting = parseSettingObject(record.setting);
  const requestParams = scriptRequestParams.value
    .map((item) => serializeScriptParam(item, true))
    .filter(Boolean);
  const responseParams = scriptResponseParams.value
    .map((item) => serializeScriptParam(item, false))
    .filter(Boolean);
  const requestSchema =
    requestParams.length > 0
      ? buildRequestSchemaFromParams(requestParams as Record<string, any>[])
      : parseJsonInput(scriptTestRequestSchemaText.value, {});
  const responseSchema =
    responseParams.length > 0
      ? buildResponseSchemaFromParams(responseParams as Record<string, any>[])
      : parseJsonInput(scriptTestResponseSchemaText.value, {});
  const headers = parseJsonInput(scriptTestHeadersText.value, {});
  const query = parseJsonInput(scriptTestQueryText.value, {});
  const pathVariables = parseJsonInput(scriptTestPathVariablesText.value, {});
  const body = parseJsonInput(scriptTestBodyText.value, {});

  scriptTestRequestSchemaText.value = toPrettyJson(requestSchema);
  scriptTestResponseSchemaText.value = toPrettyJson(responseSchema);

  return {
    ...setting,
    requestParams,
    responseParams,
    requestSchema,
    responseSchema,
    timeoutMs: scriptTestTimeoutMs.value,
    examples: [
      {
        name: '默认测试',
        method: scriptTestMethod.value,
        path: scriptTestPath.value,
        headers,
        query,
        pathVariables,
        body,
      },
      ...(Array.isArray(setting.examples) ? setting.examples.slice(1) : []),
    ],
  };
}

function substituteScriptTestPathVariables(
  path: string,
  pathVariables: Record<string, any>,
) {
  return Object.entries(pathVariables || {}).reduce((nextPath, [key, value]) => {
    const encodedValue = encodeURIComponent(String(value ?? ''));
    return nextPath
      .replaceAll(`{${key}}`, encodedValue)
      .replaceAll(`:${key}`, encodedValue);
  }, path || '');
}

function appendQueryValue(searchParams: URLSearchParams, key: string, value: any) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryValue(searchParams, key, item));
    return;
  }
  if (typeof value === 'object') {
    searchParams.append(key, JSON.stringify(value));
    return;
  }
  searchParams.append(key, String(value));
}

function buildScriptRuntimeUrl(
  record: GenericRecord,
  query: Record<string, any>,
  pathVariables: Record<string, any>,
) {
  const rawPath = substituteScriptTestPathVariables(
    scriptTestPath.value || record.path || '',
    pathVariables,
  ).trim();
  const normalizedPath = rawPath.startsWith('http://') || rawPath.startsWith('https://')
    ? rawPath
    : rawPath.startsWith('/')
      ? rawPath
      : `/${rawPath}`;
  const url = new URL(normalizedPath, window.location.origin);

  Object.entries(query || {}).forEach(([key, value]) => {
    appendQueryValue(url.searchParams, key, value);
  });
  url.searchParams.set(SIMPLE_API_TEST_MODE_PARAM, 'true');
  url.searchParams.set(SIMPLE_API_TEST_ID_PARAM, String(record.id));
  if (scriptMockLoginUserId.value) {
    url.searchParams.set(
      SIMPLE_API_MOCK_LOGIN_USER_PARAM,
      scriptMockLoginUserId.value,
    );
  }

  return url.origin === window.location.origin
    ? `${url.pathname}${url.search}`
    : url.toString();
}

async function saveScriptContentForTest(
  record: GenericRecord,
  setting: Record<string, any>,
) {
  if (!props.service.update) {
    throw new Error('当前接口不支持保存');
  }

  await props.service.update({
    forceUpdateFields: ['content', 'methods', 'path', 'setting'],
    id: record.id,
    optimisticLock: record.optimisticLock,
    content: serializeSimpleContentValue(
      contentEditorMeta.value,
      contentValue.value,
    ),
    methods: scriptTestMethod.value,
    path: scriptTestPath.value,
    setting,
  });

  if (typeof record.optimisticLock === 'number') {
    record.optimisticLock += 1;
  }
}

function getScriptRuntimeRequestOptions(
  record: GenericRecord,
  headers: Record<string, any>,
  query: Record<string, any>,
  pathVariables: Record<string, any>,
  body: any,
) {
  const method = scriptTestMethod.value.toUpperCase();
  const runtimeHeaders: Record<string, any> = {
    ...headers,
    [SIMPLE_API_TEST_MODE_HEADER]: 'true',
    [SIMPLE_API_TEST_ID_HEADER]: String(record.id),
  };

  if (scriptMockLoginUserId.value) {
    runtimeHeaders[SIMPLE_API_MOCK_LOGIN_USER_HEADER] = scriptMockLoginUserId.value;
  }

  return {
    data: ['GET', 'HEAD'].includes(method) ? undefined : body,
    headers: runtimeHeaders,
    method,
    responseReturn: 'raw',
    __silentError: true,
    url: buildScriptRuntimeUrl(record, query, pathVariables),
  };
}

function getResponseDataFromError(error: any) {
  return error?.response?.data ?? error?.data;
}

function getScriptRuntimeResponseBody(response: any) {
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    'status' in response
  ) {
    return response.data;
  }

  return response;
}

async function testScriptContent() {
  const record = contentRecord.value;

  if (!record) {
    message.warning('当前接口不支持脚本测试');
    return;
  }

  let headers: Record<string, any>;
  let query: Record<string, any>;
  let pathVariables: Record<string, any>;
  let body: any;
  let setting: Record<string, any>;

  try {
    headers = parseJsonInput(scriptTestHeadersText.value, {});
    query = parseJsonInput(scriptTestQueryText.value, {});
    pathVariables = parseJsonInput(scriptTestPathVariablesText.value, {});
    body = parseJsonInput(scriptTestBodyText.value, {});
    ({ body, headers, pathVariables, query } = applyScriptTestParamValues(
      headers,
      query,
      pathVariables,
      body,
    ));
    setting = buildScriptSetting(record);
  } catch (error) {
    const reason = error instanceof Error ? error.message : error;
    scriptWorkbenchTab.value = 'result';
    appendScriptConsole({
      success: false,
      errorType: 'ParameterParseException',
      errorMessage: `测试参数JSON格式不正确：${reason}`,
      errorStackTrace: error instanceof Error ? error.stack : undefined,
      debugInfo: {
        method: scriptTestMethod.value,
        mockLoginUserId: scriptMockLoginUserId.value,
        path: scriptTestPath.value,
      },
    });
    message.error(`测试参数JSON格式不正确：${reason}`);
    return;
  }

  scriptTestLoading.value = true;

  try {
    await saveScriptContentForTest(record, setting);
    const requestOptions = getScriptRuntimeRequestOptions(
      record,
      headers,
      query,
      pathVariables,
      body,
    );
    const result = await requestClient.request(
      requestOptions.url,
      requestOptions,
    );
    const responseBody = getScriptRuntimeResponseBody(result);

    appendScriptConsole(responseBody);
    scriptWorkbenchTab.value = 'result';
    closeScriptTestInputDialog();

    if (responseBody?.success === false) {
      message.warning('脚本测试执行失败');
    } else {
      message.success('脚本测试执行完成');
    }
  } catch (error) {
    console.error(error);
    scriptWorkbenchTab.value = 'result';
    appendScriptConsole(
      getResponseDataFromError(error) || {
        success: false,
        errorType: 'RequestException',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStackTrace: error instanceof Error ? error.stack : undefined,
        debugInfo: {
          method: scriptTestMethod.value,
          mockLoginUserId: scriptMockLoginUserId.value,
          path: scriptTestPath.value,
        },
      },
    );
    message.error('脚本测试请求失败');
  } finally {
    scriptTestLoading.value = false;
  }
}

async function ensurePermissionTreeLoaded() {
  if (permissionTree.value.length > 0) {
    return;
  }

  permissionLoading.value = true;
  try {
    permissionTree.value =
      ((await rbacService.fetchAuthorizedPermissionTree({
        excludeRootNodeTypes: [PermissionTreeNodeType.Menu],
      })) || []) as PermissionTreeNode[];
  } catch (error) {
    console.error(error);
    message.error('加载资源权限列表失败');
  } finally {
    permissionLoading.value = false;
  }
}

async function openPermissionEditor(
  record: GenericRecord,
  reload?: ReloadList,
) {
  if (!canShowManagedActions(record)) {
    message.warning('当前账号没有编辑权限');
    return;
  }

  permissionOpen.value = true;
  permissionLoading.value = true;
  permissionReload.value = reload || null;

  try {
    const freshRecord = await retrieveFreshRecord(record);
    permissionRecord.value = freshRecord;
    permissionSelection.value = normalizePermissionValues(
      freshRecord.requireAuthorizations,
    );
    await ensurePermissionTreeLoaded();
  } catch (error) {
    permissionOpen.value = false;
    console.error(error);
    message.error('加载所需权限失败');
  } finally {
    permissionLoading.value = false;
  }
}

function closePermissionEditor() {
  permissionOpen.value = false;
  permissionRecord.value = null;
  permissionSelection.value = [];
  permissionReload.value = null;
}

async function submitRequireAuthorizations() {
  const record = permissionRecord.value;

  if (!record?.id || !props.service.update) {
    message.warning('未找到可更新的记录');
    return;
  }

  permissionSubmitting.value = true;

  try {
    await props.service.update({
      forceUpdateFields: ['requireAuthorizations'],
      id: record.id,
      optimisticLock: record.optimisticLock,
      requireAuthorizations: [
        ...new Set(
          permissionSelection.value.map((item) => item.trim()).filter(Boolean),
        ),
      ],
    });
    message.success('所需权限已更新');
    const reload = permissionReload.value;
    closePermissionEditor();
    await reload?.();
  } catch (error) {
    console.error(error);
    message.error('所需权限更新失败');
  } finally {
    permissionSubmitting.value = false;
  }
}
</script>

<template>
  <CrudPage :config="managedConfig">
    <template #row-actions="{ record, reload }">
      <Button
        v-if="canShowManagedActions(record)"
        size="small"
        type="link"
        @click="openContentEditor(record, reload)"
      >
        {{ getContentEditorActionText() }}
      </Button>
      <Button
        v-if="canShowManagedActions(record)"
        class="simple-action-count-button"
        :data-count="getRequireAuthorizationCount(record)"
        size="small"
        type="link"
        @click="openPermissionEditor(record, reload)"
      >
        所需权限
        <span
          v-if="getRequireAuthorizationCount(record) > 0"
          class="simple-action-count-badge"
        >
          {{ getRequireAuthorizationCount(record) }}
        </span>
      </Button>
    </template>
  </CrudPage>

  <Modal
    :body-style="{ maxHeight: 'calc(100vh - 220px)', overflow: 'auto' }"
    :confirm-loading="contentSubmitting"
    destroy-on-close
    :mask-closable="false"
    :open="contentOpen"
    :title="contentModalTitle"
    width="min(86vw, 1480px)"
    @cancel="closeContentEditor"
    @ok="submitContent"
  >
    <Spin :spinning="contentLoading">
      <div v-if="canShowScriptTestPanel" class="simple-script-workbench">
        <aside class="simple-script-variable-panel">
          <div
            v-for="group in scriptVariableGroups"
            :key="group.title"
            class="simple-script-variable-group"
          >
            <div class="simple-script-variable-title">{{ group.title }}</div>
            <code
              v-for="item in group.items"
              :key="item"
              class="simple-script-variable-item"
            >
              {{ item }}
            </code>
          </div>
        </aside>

        <section class="simple-script-editor-panel">
          <Tabs
            v-model:active-key="scriptEditorTab"
            class="simple-script-editor-tabs"
            size="small"
          >
            <Tabs.TabPane key="code" tab="代码">
              <JsonEditorField
                v-if="contentEditorMeta.kind === 'json'"
                v-model="contentValue"
                inline
                inline-min-height="min(70vh, 760px)"
                :title="contentEditorMeta.title"
              />
              <CodeEditorField
                v-else-if="contentEditorMeta.kind === 'code'"
                v-model="contentValue"
                inline
                :language="contentEditorMeta.language"
                :title="contentEditorMeta.title"
              />
              <Input.TextArea
                v-else
                v-model:value="contentValue"
                :auto-size="{ minRows: 18, maxRows: 28 }"
              />
            </Tabs.TabPane>
            <Tabs.TabPane key="debug" tab="调试">
              <section class="simple-script-debug-panel">
                <Space class="mb-3 w-full" :size="8">
                  <Select
                    v-model:value="scriptTestMethod"
                    class="simple-script-test-method"
                    :options="scriptTestMethodOptions"
                  />
                  <Input v-model:value="scriptTestPath" placeholder="测试路径" />
                  <InputNumber
                    v-model:value="scriptTestTimeoutMs"
                    :max="10000"
                    :min="100"
                    :step="100"
                  />
                  <Button @click="openScriptTestInputDialog">
                    填写测试参数
                  </Button>
                  <Button
                    class="simple-script-run-button"
                    :loading="scriptTestLoading"
                    type="primary"
                    @click="testScriptContent"
                  >
                    运行测试
                  </Button>
                </Space>

                <Tabs v-model:active-key="scriptWorkbenchTab" size="small">
                  <Tabs.TabPane key="input" tab="测试输入">
                    <div class="simple-script-debug-grid">
                      <div>
                        <div class="simple-script-test-label">请求头 Headers JSON</div>
                        <Input.TextArea
                          v-model:value="scriptTestHeadersText"
                          class="simple-script-test-textarea"
                          :auto-size="{ minRows: 3, maxRows: 6 }"
                        />
                      </div>
                      <div>
                        <div class="simple-script-test-label">查询参数/表单 Query JSON</div>
                        <Input.TextArea
                          v-model:value="scriptTestQueryText"
                          class="simple-script-test-textarea"
                          :auto-size="{ minRows: 3, maxRows: 6 }"
                        />
                      </div>
                      <div>
                        <div class="simple-script-test-label">路径变量 Path Variables JSON</div>
                        <Input.TextArea
                          v-model:value="scriptTestPathVariablesText"
                          class="simple-script-test-textarea"
                          :auto-size="{ minRows: 3, maxRows: 6 }"
                        />
                      </div>
                      <div>
                        <div class="simple-script-test-label">请求体 Body JSON</div>
                        <Input.TextArea
                          v-model:value="scriptTestBodyText"
                          class="simple-script-test-textarea"
                          :auto-size="{ minRows: 3, maxRows: 6 }"
                        />
                      </div>
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane key="requestParams" tab="入参定义">
                    <div class="simple-script-param-toolbar">
                      <Button size="small" type="primary" @click="addRequestParam">
                        新增入参
                      </Button>
                    </div>
                    <div class="simple-script-param-table">
                      <div class="simple-script-param-head simple-script-request-param-grid">
                        <span>名称</span>
                        <span>来源</span>
                        <span>类型</span>
                        <span>必填</span>
                        <span>默认值</span>
                        <span>枚举</span>
                        <span>规则</span>
                        <span>说明</span>
                        <span>操作</span>
                      </div>
                      <div
                        v-for="(param, index) in scriptRequestParams"
                        :key="index"
                        class="simple-script-param-row simple-script-request-param-grid"
                      >
                        <Input v-model:value="param.name" placeholder="参数名" />
                        <Select
                          v-model:value="param.in"
                          :options="scriptParamInOptions"
                        />
                        <Select
                          v-model:value="param.type"
                          :options="scriptParamTypeOptions"
                        />
                        <Checkbox v-model:checked="param.required" />
                        <Input v-model:value="param.defaultValue" placeholder="JSON/文本" />
                        <Input v-model:value="param.enumText" placeholder="逗号分隔" />
                        <Space direction="vertical" :size="4">
                          <Input v-model:value="param.pattern" placeholder="pattern" />
                          <Space :size="4">
                            <InputNumber v-model:value="param.minimum" placeholder="min" />
                            <InputNumber v-model:value="param.maximum" placeholder="max" />
                          </Space>
                          <Space :size="4">
                            <InputNumber v-model:value="param.minLength" placeholder="minLen" />
                            <InputNumber v-model:value="param.maxLength" placeholder="maxLen" />
                          </Space>
                        </Space>
                        <Input v-model:value="param.description" placeholder="说明" />
                        <Button size="small" type="link" @click="removeRequestParam(index)">
                          删除
                        </Button>
                      </div>
                      <div v-if="scriptRequestParams.length === 0" class="simple-script-param-empty">
                        暂无入参定义
                      </div>
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane key="responseParams" tab="出参定义">
                    <div class="simple-script-param-toolbar">
                      <Button size="small" type="primary" @click="addResponseParam">
                        新增出参
                      </Button>
                    </div>
                    <div class="simple-script-param-table">
                      <div class="simple-script-param-head simple-script-response-param-grid">
                        <span>名称</span>
                        <span>类型</span>
                        <span>必填</span>
                        <span>默认值</span>
                        <span>枚举</span>
                        <span>规则</span>
                        <span>说明</span>
                        <span>操作</span>
                      </div>
                      <div
                        v-for="(param, index) in scriptResponseParams"
                        :key="index"
                        class="simple-script-param-row simple-script-response-param-grid"
                      >
                        <Input v-model:value="param.name" placeholder="字段名" />
                        <Select
                          v-model:value="param.type"
                          :options="scriptParamTypeOptions"
                        />
                        <Checkbox v-model:checked="param.required" />
                        <Input v-model:value="param.defaultValue" placeholder="JSON/文本" />
                        <Input v-model:value="param.enumText" placeholder="逗号分隔" />
                        <Space direction="vertical" :size="4">
                          <Input v-model:value="param.pattern" placeholder="pattern" />
                          <Space :size="4">
                            <InputNumber v-model:value="param.minimum" placeholder="min" />
                            <InputNumber v-model:value="param.maximum" placeholder="max" />
                          </Space>
                          <Space :size="4">
                            <InputNumber v-model:value="param.minLength" placeholder="minLen" />
                            <InputNumber v-model:value="param.maxLength" placeholder="maxLen" />
                          </Space>
                        </Space>
                        <Input v-model:value="param.description" placeholder="说明" />
                        <Button size="small" type="link" @click="removeResponseParam(index)">
                          删除
                        </Button>
                      </div>
                      <div v-if="scriptResponseParams.length === 0" class="simple-script-param-empty">
                        暂无出参定义
                      </div>
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane key="requestSchema" tab="入参契约">
                    <Input.TextArea
                      v-model:value="scriptTestRequestSchemaText"
                      class="simple-script-test-textarea"
                      :auto-size="{ minRows: 8, maxRows: 16 }"
                    />
                  </Tabs.TabPane>
                  <Tabs.TabPane key="responseSchema" tab="出参契约">
                    <Input.TextArea
                      v-model:value="scriptTestResponseSchemaText"
                      class="simple-script-test-textarea"
                      :auto-size="{ minRows: 8, maxRows: 16 }"
                    />
                  </Tabs.TabPane>
                  <Tabs.TabPane key="result" tab="控制台输出">
                    <div class="simple-script-console-toolbar">
                      <Button size="small" @click="clearScriptConsole">
                        清空
                      </Button>
                    </div>
                    <pre class="simple-script-test-result">{{
                      scriptTestResult || '暂无控制台输出'
                    }}</pre>
                  </Tabs.TabPane>
                </Tabs>
              </section>
            </Tabs.TabPane>
            <Tabs.TabPane key="help" tab="帮助">
              <div class="simple-script-help">
                <section
                  v-for="section in scriptHelpSections"
                  :key="section.title"
                  class="simple-script-help-section"
                >
                  <h4>{{ section.title }}</h4>
                  <ul>
                    <li v-for="item in section.items" :key="item">
                      {{ item }}
                    </li>
                  </ul>
                </section>
                <section class="simple-script-help-section">
                  <h4>示例</h4>
                  <pre class="simple-script-help-code">{{ scriptHelpExample }}</pre>
                </section>
              </div>
            </Tabs.TabPane>
          </Tabs>
        </section>
      </div>

      <div v-else class="simple-content-editor-single">
        <JsonEditorField
          v-if="contentEditorMeta.kind === 'json'"
          v-model="contentValue"
          inline
          inline-min-height="min(70vh, 760px)"
          :title="contentEditorMeta.title"
        />
        <CodeEditorField
          v-else-if="contentEditorMeta.kind === 'code'"
          v-model="contentValue"
          inline
          :language="contentEditorMeta.language"
          :title="contentEditorMeta.title"
        />
        <Input.TextArea
          v-else
          v-model:value="contentValue"
          :auto-size="{ minRows: 18, maxRows: 28 }"
        />
      </div>
    </Spin>
  </Modal>

  <Modal
    destroy-on-close
    :footer="null"
    :mask-closable="false"
    :open="scriptTestInputOpen"
    title="填写测试参数"
    :width="920"
    @cancel="closeScriptTestInputDialog"
  >
    <div class="simple-script-test-input-dialog">
      <div class="simple-script-test-login-row">
        <span class="simple-script-test-label">模拟登录用户</span>
        <Select
          v-model:value="scriptMockLoginUserId"
          allow-clear
          class="simple-script-test-user-select"
          :filter-option="false"
          :loading="scriptMockUserLoading"
          :options="scriptMockUserOptions"
          placeholder="不选择则使用当前登录态，未登录时为空"
          show-search
          @search="loadScriptMockUserOptions"
        />
      </div>

      <div
        v-if="scriptRequestParams.length > 0"
        class="simple-script-test-input-grid"
      >
        <label
          v-for="param in scriptRequestParams"
          :key="getScriptParamKey(param)"
          class="simple-script-test-input-item"
        >
          <span class="simple-script-test-input-title">
            {{ param.name || '未命名参数' }}
            <span v-if="param.required" class="simple-script-required-mark">*</span>
          </span>
          <span class="simple-script-test-input-meta">
            {{ getScriptParamInLabel(param.in) }} · {{ param.type || 'string' }}
          </span>
          <Input
            v-model:value="scriptTestParamValues[getScriptParamKey(param)]"
            :placeholder="param.description || param.defaultValue || '请输入测试值'"
          />
        </label>
      </div>
      <div v-else class="simple-script-param-empty">
        暂无入参定义，可使用测试输入页签中的 JSON 输入。
      </div>

      <div class="simple-script-test-dialog-actions">
        <Button @click="closeScriptTestInputDialog">取消</Button>
        <Button
          :loading="scriptTestLoading"
          type="primary"
          @click="testScriptContent"
        >
          测试
        </Button>
      </div>
    </div>
  </Modal>

  <Modal
    :confirm-loading="permissionSubmitting"
    destroy-on-close
    :mask-closable="false"
    :open="permissionOpen"
    :title="permissionModalTitle"
    :width="1080"
    @cancel="closePermissionEditor"
    @ok="submitRequireAuthorizations"
  >
    <div class="max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
      <Spin :spinning="permissionLoading">
        <ResourcePermissionTreeEditor
          v-model:value="permissionSelection"
          :permission-tree="permissionTree"
        />
      </Spin>
    </div>
  </Modal>
</template>

<style scoped>
.simple-action-count-button {
  position: relative;
  overflow: visible;
}

.simple-action-count-badge {
  position: absolute;
  top: -5px;
  right: -3px;
  display: inline-flex;
  min-width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  color: hsl(var(--primary-foreground));
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  background: hsl(var(--primary));
  border: 1px solid hsl(var(--background));
  border-radius: 999px;
  box-shadow: 0 2px 6px hsl(var(--primary) / 28%);
}

.simple-script-workbench {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
}

.simple-content-editor-single {
  min-width: 0;
}

.simple-script-variable-panel,
.simple-script-editor-panel,
.simple-script-debug-panel {
  min-width: 0;
}

.simple-script-variable-panel {
  max-height: min(70vh, 760px);
  padding-right: 12px;
  overflow: auto;
  border-right: 1px solid hsl(var(--border));
}

.simple-script-variable-group + .simple-script-variable-group {
  margin-top: 14px;
}

.simple-script-variable-title {
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
}

.simple-script-variable-item {
  display: block;
  padding: 5px 8px;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.simple-script-variable-item + .simple-script-variable-item {
  margin-top: 6px;
}

.simple-script-editor-panel {
  min-height: 360px;
}

.simple-script-editor-tabs {
  min-width: 0;
}

.simple-script-help {
  max-height: min(62vh, 680px);
  padding: 4px 6px 12px;
  overflow: auto;
}

.simple-script-help-section + .simple-script-help-section {
  margin-top: 16px;
}

.simple-script-help-section h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.simple-script-help-section ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 1.6;
}

.simple-script-help-code {
  max-height: 260px;
  padding: 12px;
  overflow: auto;
  color: hsl(var(--foreground));
  font-size: 12px;
  line-height: 1.55;
  background: hsl(var(--muted) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.simple-script-debug-panel {
  min-width: 0;
  max-height: min(62vh, 680px);
  overflow: auto;
}

.simple-script-debug-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.simple-script-param-toolbar {
  margin-bottom: 10px;
}

.simple-script-param-table {
  min-width: 960px;
  overflow-x: auto;
}

.simple-script-request-param-grid {
  grid-template-columns:
    minmax(120px, 1.1fr) minmax(94px, 0.7fr) minmax(100px, 0.8fr)
    54px minmax(120px, 1fr) minmax(120px, 1fr) minmax(180px, 1.5fr)
    minmax(120px, 1fr) 58px;
}

.simple-script-response-param-grid {
  grid-template-columns:
    minmax(120px, 1.1fr) minmax(100px, 0.8fr) 54px
    minmax(120px, 1fr) minmax(120px, 1fr) minmax(180px, 1.5fr)
    minmax(120px, 1fr) 58px;
}

.simple-script-param-head,
.simple-script-param-row {
  display: grid;
  gap: 8px;
  align-items: center;
}

.simple-script-param-head {
  padding: 8px 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px 6px 0 0;
}

.simple-script-param-row {
  padding: 8px 10px;
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  border-left: 1px solid hsl(var(--border));
}

.simple-script-param-empty {
  padding: 18px;
  color: hsl(var(--muted-foreground));
  text-align: center;
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  border-left: 1px solid hsl(var(--border));
  border-radius: 0 0 6px 6px;
}

.simple-script-run-button {
  flex: 0 0 auto;
}

.simple-script-test-panel {
  min-width: 0;
  padding-left: 16px;
  border-left: 1px solid hsl(var(--border));
}

.simple-script-test-title {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
}

.simple-script-test-method {
  width: 98px;
  flex: 0 0 98px;
}

.simple-script-test-label {
  margin: 10px 0 6px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.simple-script-test-input-dialog {
  display: grid;
  gap: 14px;
}

.simple-script-test-login-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.simple-script-test-user-select {
  width: 100%;
}

.simple-script-test-input-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.simple-script-test-input-item {
  display: grid;
  gap: 5px;
}

.simple-script-test-input-title {
  font-size: 13px;
  font-weight: 600;
}

.simple-script-test-input-meta {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.simple-script-required-mark {
  color: hsl(var(--destructive));
}

.simple-script-test-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.simple-script-test-textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
}

.simple-script-console-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.simple-script-test-result {
  min-height: 120px;
  max-height: 220px;
  padding: 10px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  background: hsl(var(--muted) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 1180px) {
  .simple-script-workbench,
  .simple-script-debug-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .simple-script-variable-panel {
    max-height: 220px;
    padding-right: 0;
    padding-bottom: 12px;
    border-right: 0;
    border-bottom: 1px solid hsl(var(--border));
  }
}
</style>
