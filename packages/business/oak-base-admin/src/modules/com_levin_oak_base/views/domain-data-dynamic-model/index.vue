<script setup lang="ts">
import type {
  DataModelDefinition,
  DataModelField,
  DataModelNamingPreview,
  DataModelPermissionGroup,
  DataModelPreview,
  DataModelSystemField,
  SaveDataModelFieldsInput,
} from '../../api/data-model-service';
import type { FieldSourceFilter } from './field-table';

import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

import {
  useAccessStore,
  useTabbarStore,
  useUserStore,
} from '@vben/runtime/stores';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import DynamicCrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import {
  isTenantAdminUser,
  isTopSuperAdminUser,
} from '@levin/admin-framework/framework-commons/shared/user-identity';
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { dataModelService } from '../../api/data-model-service';
import { menuService } from '../../api/menu-service';
import {
  confidentialLevelOptionsLoader,
  userOptionsLoader,
} from '../api-module';
import { confidentialLevelOptions } from './confidential-level';
import { definitionCrudConfig } from './definition-crud-adapter';
import {
  buildFieldTableRows,
  cloneDataModelDto,
  fieldSaveRequest,
  removeBusinessField,
  upsertBusinessField,
} from './field-table';
import {
  allowedQueryOperators,
  queryOperatorLabels,
  reservedModelFieldNames,
  withFieldUsageDefaults,
} from './field-usage';
import { scopeOptions } from './model-form';
import { useModelMetadataContext } from './model-metadata';
import OperationsManager from './operations-manager.vue';

const fieldTypes = [
  ['STRING', '字符串'],
  ['TEXT', '长文本'],
  ['INTEGER', '整数'],
  ['BIG_INTEGER', '大整数'],
  ['DECIMAL', '精确小数'],
  ['MONEY', '金融金额'],
  ['BOOLEAN', '布尔值'],
  ['DATE', '日期'],
  ['TIME', '时间'],
  ['DATETIME', '日期时间'],
  ['UUID', 'UUID'],
  ['JSON', 'JSON'],
].map(([value, label]) => ({ value, label }));
const { hasPermission } = useRbacAccess();
const router = useRouter();
const userStore = useUserStore();
const metadataContext = useModelMetadataContext();
const canChooseOwner = computed(
  () =>
    isTopSuperAdminUser(userStore.userInfo) ||
    isTenantAdminUser(userStore.userInfo),
);
const hasTrustedTenant = computed(() => Boolean(userStore.userInfo?.tenantId));
const hasTrustedOrg = computed(
  () => hasTrustedTenant.value && Boolean(userStore.userInfo?.orgId),
);
const availableScopes = computed(() =>
  scopeOptions.filter(
    (item) =>
      (['ORG', 'PRIVATE'].includes(item.value) && hasTrustedOrg.value) ||
      (item.value === 'TENANT' &&
        hasTrustedTenant.value &&
        canChooseOwner.value) ||
      (item.value === 'PLATFORM' && isTopSuperAdminUser(userStore.userInfo)),
  ),
);
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(dataModelService, method));
const canGenerateMenu = () =>
  allowed('generateMenu') &&
  hasPermission(buildApiMethodPermissions(menuService, 'create'));
const definitionList = ref<{ reload: () => Promise<void> }>();
const current = ref<DataModelDefinition>();
const fieldsDraft = ref<SaveDataModelFieldsInput>();
// 固定字段只用于服务端目录展示，不进入字段保存草稿。
const systemFields = ref<DataModelSystemField[]>([]);
const fieldsOpen = ref(false);
const fieldSourceFilter = ref<FieldSourceFilter>('BUSINESS');
const fieldsSaving = ref(false);
const rowEditorOpen = ref(false);
const rowDraft = ref<DataModelField>();
const rowIndex = ref(-1);
const rowOptionText = ref('[]');
const rowOptionError = ref('');
const groupEditorOpen = ref(false);
const groupDraft = ref<DataModelPermissionGroup>();
const groupIndex = ref(-1);
const confidentialOptions = ref<Array<{ label: string; value: number }>>([]);
const preview = ref<DataModelPreview>();
const previewOpen = ref(false);
const namingPreview = ref<DataModelNamingPreview>();
const namingOpen = ref(false);
const namingBusy = ref(false);
const syncing = ref(false);
const generatingMenu = ref<string>();
const operationModel = ref<DataModelDefinition>();
const operationsOpen = ref(false);
const operationsLoading = ref(false);

const fieldColumns = [
  { title: '来源', key: 'source', width: 118, ellipsis: true },
  {
    title: '属性名',
    dataIndex: 'name',
    key: 'name',
    width: 205,
    ellipsis: true,
  },
  {
    title: '中文标题',
    dataIndex: 'title',
    key: 'title',
    width: 160,
    ellipsis: true,
  },
  { title: '类型', dataIndex: 'type', key: 'type', width: 112, ellipsis: true },
  { title: '数据权限组', key: 'permissionGroup', width: 160, ellipsis: true },
  { title: '用途', key: 'usage', width: 210 },
  { title: '操作', key: 'fieldActions', width: 168, fixed: 'right' as const },
];
const parameterColumns = [
  { title: '协议路径', key: 'wirePath', width: 190 },
  { title: '参数名', dataIndex: 'name' },
  { title: '中文名称', dataIndex: 'title' },
  { title: '类型', dataIndex: 'type' },
  { title: '可空', key: 'nullable' },
  { title: '来源', dataIndex: 'source' },
  { title: '服务端管理', key: 'serverManaged' },
  { title: '受控筛选', key: 'controlledFilter' },
  { title: '操作符', key: 'operators' },
  { title: '默认值', key: 'defaultValue' },
  { title: '可选项', key: 'options' },
  { title: '描述', dataIndex: 'description' },
];
const groupColumns = [
  { title: '稳定标识', dataIndex: 'key' },
  { title: '中文标题', dataIndex: 'title' },
  { title: '说明', dataIndex: 'description' },
  { title: '机密级别', dataIndex: 'confidentialLevel' },
  { title: '操作', key: 'groupActions' },
];
const fieldRows = computed(() =>
  buildFieldTableRows(
    fieldsDraft.value?.fields || [],
    systemFields.value,
    fieldSourceFilter.value,
  ),
);

function fieldUsageSummary(field: DataModelField) {
  return (
    [
      field.queryEnabled && '查',
      field.listEnabled !== false && '列',
      field.createEnabled !== false && '新',
      field.editEnabled !== false && '改',
      field.detailEnabled !== false && '详',
    ]
      .filter(Boolean)
      .join(' · ') || '—'
  );
}

function fieldUsageDescription(field: DataModelField) {
  return (
    [
      field.queryEnabled && '查询',
      field.listEnabled !== false && '列表',
      field.createEnabled !== false && '新增',
      field.editEnabled !== false && '编辑',
      field.detailEnabled !== false && '详情',
    ]
      .filter(Boolean)
      .join('、') || '未用于运行页面'
  );
}

function fieldSourceLabel(source: string) {
  if (source === 'MODEL_ATTRIBUTE') return '模型属性';
  if (source === 'RECORD_SYSTEM') return '记录系统列';
  return '业务字段';
}

// 弹窗保存后只刷新当前定义列表，保持其查询、分页、排序和列偏好。
async function load() {
  await definitionList.value?.reload();
}
const managementConfig = computed(() =>
  definitionCrudConfig({
    context: () => metadataContext.value,
    ownerAllowed: canChooseOwner.value,
    ownerLoader: userOptionsLoader,
    scopes: availableScopes.value,
    rowActions: [
      {
        label: '字段管理',
        displayKey: 'fields',
        permission: buildApiMethodPermissions(dataModelService, 'saveFields'),
        handler: (row) => openFields(row as DataModelDefinition),
      },
      {
        label: '接口管理',
        displayKey: 'operations',
        permission: buildApiMethodPermissions(
          dataModelService,
          'getDefinition',
        ),
        handler: (row) => openOperations(row as DataModelDefinition),
      },
      {
        label: '预览结构差异',
        displayKey: 'structure',
        permission: buildApiMethodPermissions(dataModelService, 'preview'),
        handler: (row) => openPreview(row as DataModelDefinition),
      },
      {
        label: '升级字段命名',
        displayKey: 'migrateNaming',
        permission: buildApiMethodPermissions(
          dataModelService,
          'migrateNaming',
        ),
        visible: (row) => row.requiresNamingMigration === true,
        handler: async (row) => {
          namingPreview.value = undefined;
          namingOpen.value = true;
          namingPreview.value = await dataModelService.previewNamingMigration(
            row.key,
          );
        },
      },
      {
        label: '生成菜单',
        displayKey: 'generate',
        visible: (row) =>
          !row.requiresNamingMigration &&
          row.enabled === true &&
          Number(row.syncedVersion) > 0 &&
          canGenerateMenu(),
        permission: buildApiMethodPermissions(dataModelService, 'generateMenu'),
        handler: (row) => generateMenu(row as DataModelDefinition),
      },
      {
        label: '启用/禁用',
        displayKey: 'enabled',
        permission: buildApiMethodPermissions(
          dataModelService,
          'setModelEnabled',
        ),
        confirmText: '确定调整该模型的启用状态吗？',
        handler: (row) => toggleModelEnabled(row as DataModelDefinition),
      },
    ],
  }),
);

function newField(): DataModelField {
  return withFieldUsageDefaults({
    key: '',
    name: '',
    title: '',
    type: 'STRING',
    nullable: true,
    length: 255,
    precision: 78,
    scale: 18,
  });
}

function setFieldType(field: DataModelField, type: DataModelField['type']) {
  field.type = type;
  if (type === 'STRING') field.length ??= 255;
  if (type === 'DECIMAL' || type === 'MONEY') {
    field.precision ??= 38;
    field.scale ??= type === 'MONEY' ? 8 : 6;
  }
  field.queryOperators = (field.queryOperators || []).filter((operator) =>
    allowedQueryOperators(type).includes(operator),
  );
  if (type === 'JSON') field.queryEnabled = false;
}

async function openFields(model: DataModelDefinition) {
  if (!allowed('saveFields') || !allowed('getDefinition')) return;
  try {
    const latest = await dataModelService.getDefinition(model.key);
    if (!Number.isInteger(latest.version)) throw new Error('缺少定义版本');
    fieldsDraft.value = {
      key: latest.key,
      expectedVersion: Number(latest.version),
      fields: (latest.fields || []).map((field) =>
        withFieldUsageDefaults(cloneDataModelDto(field)),
      ),
      permissionGroups: (latest.permissionGroups || []).map((group) =>
        cloneDataModelDto(group),
      ),
    };
    systemFields.value = cloneDataModelDto(latest.systemFields || []);
    fieldSourceFilter.value = 'BUSINESS';
    fieldsOpen.value = true;
    void loadConfidentialLevels();
  } catch {
    message.error('字段定义读取失败，请刷新后重试');
  }
}

async function loadConfidentialLevels() {
  try {
    const options = await confidentialLevelOptionsLoader();
    confidentialOptions.value = confidentialLevelOptions(options);
  } catch {
    confidentialOptions.value = [];
  }
}

async function openOperations(model: DataModelDefinition) {
  if (!allowed('getDefinition')) return;
  operationModel.value = undefined;
  operationsOpen.value = true;
  operationsLoading.value = true;
  try {
    operationModel.value = await dataModelService.getDefinition(model.key);
  } catch {
    message.error('模型操作契约加载失败');
  } finally {
    operationsLoading.value = false;
  }
}

function validateFields(model: SaveDataModelFieldsInput): string | undefined {
  const groupKeys = new Set<string>();
  for (const group of model.permissionGroups || []) {
    if (
      !/^[a-z][a-z0-9_]{0,47}$/.test(group.key) ||
      !group.title.trim() ||
      group.title.length > 128 ||
      (group.description?.length || 0) > 2000 ||
      !Number.isInteger(group.confidentialLevel)
    )
      return `数据权限组 ${group.key || '未命名'} 的标识、标题或机密级别无效`;
    if (groupKeys.has(group.key)) return `数据权限组 ${group.key} 重复`;
    groupKeys.add(group.key);
  }
  const names = new Set<string>();
  const keys = new Set<string>();
  for (const field of model.fields) {
    if (!/^[a-z][a-z0-9_]{0,47}$/.test(field.key))
      return `字段 ${field.title || field.name || '未命名'} 的稳定标识不合法`;
    if (!/^[a-z]\w{0,47}$/.test(field.name))
      return `字段 ${field.title || field.name || '未命名'} 的名称不合法`;
    if (reservedModelFieldNames.has(field.name))
      return `字段 ${field.name} 是系统固定属性，不能作为业务字段`;
    if (field.permissionGroupKey && !groupKeys.has(field.permissionGroupKey))
      return `字段 ${field.name} 引用了不存在的数据权限组`;
    if (!field.title.trim()) return `请填写字段 ${field.name} 的标题`;
    if (keys.has(field.key)) return `字段标识 ${field.key} 重复`;
    if (names.has(field.name)) return `字段 ${field.name} 重复`;
    keys.add(field.key);
    names.add(field.name);
    if (field.optionSource === 'FIXED' && !field.options?.length)
      return `字段 ${field.name} 缺少固定选项`;
    if (
      !field.nullable &&
      field.createEnabled === false &&
      (field.defaultValue === undefined || field.defaultValue === null)
    )
      return `字段 ${field.name} 不可空且不在新增表单展示，必须提供默认值`;
    if (
      field.queryEnabled &&
      (!field.queryOperators?.length ||
        field.queryOperators.some(
          (operator) => !allowedQueryOperators(field.type).includes(operator),
        ))
    )
      return `字段 ${field.name} 的查询操作符与类型不匹配`;
  }
  return undefined;
}

function groupTitle(key?: null | string) {
  return key
    ? fieldsDraft.value?.permissionGroups?.find((group) => group.key === key)
        ?.title || key
    : '未分组';
}

function editGroup(index = -1) {
  if (!fieldsDraft.value) return;
  groupIndex.value = index;
  const current = fieldsDraft.value.permissionGroups?.[index];
  groupDraft.value = current
    ? cloneDataModelDto(current)
    : {
        key: '',
        title: '',
        description: '',
        confidentialLevel: confidentialOptions.value[0]?.value ?? 0,
      };
  groupEditorOpen.value = true;
}

function saveGroup() {
  if (!groupDraft.value || !fieldsDraft.value) return;
  const draft = groupDraft.value;
  if (
    !/^[a-z][a-z0-9_]{0,47}$/.test(draft.key) ||
    !draft.title.trim() ||
    draft.title.length > 128 ||
    (draft.description?.length || 0) > 2000 ||
    !confidentialOptions.value.some(
      (item) => item.value === draft.confidentialLevel,
    )
  ) {
    message.error('请填写合法分组标识、标题并选择机密级别');
    return;
  }
  const groups = [...(fieldsDraft.value.permissionGroups || [])];
  if (
    groups.some(
      (group, index) => index !== groupIndex.value && group.key === draft.key,
    )
  ) {
    message.error('数据权限组标识重复');
    return;
  }
  if (groupIndex.value < 0) groups.push(cloneDataModelDto(draft));
  else groups[groupIndex.value] = cloneDataModelDto(draft);
  fieldsDraft.value.permissionGroups = groups;
  if (groupIndex.value < 0 && rowEditorOpen.value && rowDraft.value)
    rowDraft.value.permissionGroupKey = draft.key;
  groupEditorOpen.value = false;
}

function removeGroup(index: number) {
  if (!fieldsDraft.value?.permissionGroups) return;
  const key = fieldsDraft.value.permissionGroups[index]?.key;
  if (
    fieldsDraft.value.fields.some((field) => field.permissionGroupKey === key)
  ) {
    message.error('该权限组仍被业务字段使用，请先调整字段分组');
    return;
  }
  fieldsDraft.value.permissionGroups.splice(index, 1);
}

function editField(index = -1) {
  if (!fieldsDraft.value) return;
  const candidate = index < 0 ? newField() : fieldsDraft.value.fields[index];
  if (!candidate) return;
  rowIndex.value = index;
  rowDraft.value = cloneDataModelDto(candidate);
  rowOptionText.value = JSON.stringify(rowDraft.value.options || [], null, 2);
  rowOptionError.value = '';
  rowEditorOpen.value = true;
}

function setFixedOptions(text: string) {
  if (!rowDraft.value) return;
  rowOptionText.value = text;
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          ['boolean', 'number', 'string'].includes(typeof item.value) &&
          typeof item.label === 'string' &&
          item.label.trim(),
      )
    ) {
      throw new Error('选项格式无效');
    }
    rowDraft.value.options = parsed;
    rowOptionError.value = '';
  } catch {
    rowOptionError.value = '固定选项必须是有效的 value/label 数组';
  }
}

function saveFieldRow() {
  if (!rowDraft.value || !fieldsDraft.value) return;
  if (rowOptionError.value) {
    message.error(rowOptionError.value);
    return;
  }
  const nextFields = upsertBusinessField(
    fieldsDraft.value.fields,
    rowIndex.value,
    rowDraft.value,
  );
  const problem = validateFields({ ...fieldsDraft.value, fields: nextFields });
  if (problem) {
    message.error(problem);
    return;
  }
  fieldsDraft.value.fields = nextFields;
  rowEditorOpen.value = false;
}

function removeField(index: number) {
  if (!fieldsDraft.value) return;
  fieldsDraft.value.fields = removeBusinessField(
    fieldsDraft.value.fields,
    index,
  );
}

async function saveFields() {
  if (!fieldsDraft.value || !allowed('saveFields')) return;
  const problem = validateFields(fieldsDraft.value);
  if (problem) {
    message.error(problem);
    return;
  }
  fieldsSaving.value = true;
  try {
    await dataModelService.saveFields(fieldSaveRequest(fieldsDraft.value));
    fieldsOpen.value = false;
    message.success('业务字段已保存');
    await load();
  } catch {
    message.error('字段保存失败，版本可能已变化，请重新打开字段管理');
  } finally {
    fieldsSaving.value = false;
  }
}

async function toggleModelEnabled(model: DataModelDefinition) {
  if (!allowed('setModelEnabled')) return;
  try {
    await dataModelService.setModelEnabled(model.key, model.enabled !== true);
    message.success(model.enabled ? '模型已禁用' : '模型已启用');
    await load();
  } catch {
    message.error('模型启用状态更新失败');
  }
}

async function generateMenu(model: DataModelDefinition) {
  if (!canGenerateMenu() || model.enabled !== true || !model.syncedVersion)
    return;
  generatingMenu.value = model.key;
  try {
    await dataModelService.generateMenu(model.key);
  } catch {
    message.error('生成菜单失败，请检查模型同步状态与菜单权限');
    generatingMenu.value = undefined;
    return;
  }
  try {
    useAccessStore().setIsAccessChecked(false);
    await router.replace(router.currentRoute.value.fullPath);
    await useTabbarStore().invalidateCachedRouteViews(router);
    message.success('模型菜单已生成，导航已刷新');
  } catch {
    message.warning('菜单已生成，导航暂未刷新，请刷新当前页面');
  } finally {
    generatingMenu.value = undefined;
  }
}

async function openPreview(model: DataModelDefinition) {
  if (!allowed('preview')) return;
  preview.value = undefined;
  current.value = model;
  previewOpen.value = true;
  try {
    preview.value = await dataModelService.preview(model.key);
  } catch {
    message.error('结构差异预览失败');
  }
}

// 同步仅使用本次预览的版本和指纹；风险操作由服务端拒绝。
async function sync() {
  if (
    !current.value ||
    !preview.value ||
    preview.value.risks.length > 0 ||
    !allowed('sync')
  )
    return;
  syncing.value = true;
  try {
    await dataModelService.sync(
      current.value.key,
      preview.value.definitionVersion,
      preview.value.fingerprint,
    );
    previewOpen.value = false;
    message.success('数据库结构同步完成');
    await load();
  } catch {
    message.error('结构同步失败，请重新预览差异');
  } finally {
    syncing.value = false;
  }
}

async function migrateNaming() {
  const checked = namingPreview.value;
  if (!checked || checked.risks.length > 0 || !allowed('migrateNaming')) return;
  namingBusy.value = true;
  try {
    await dataModelService.migrateNaming(
      checked.key,
      checked.definitionVersion,
      checked.fingerprint,
    );
    namingOpen.value = false;
    message.success('字段命名已升级');
    await load();
  } catch {
    message.error('字段命名升级失败，请重新预览后重试');
  } finally {
    namingBusy.value = false;
  }
}

// 真实身份与权限范围变化时清理弹窗内旧定义；同主体凭据续期不触发此上下文。
watch(metadataContext, () => {
  namingOpen.value = false;
  namingPreview.value = undefined;
  fieldsOpen.value = false;
  rowEditorOpen.value = false;
  groupEditorOpen.value = false;
  operationsOpen.value = false;
  previewOpen.value = false;
  fieldsDraft.value = undefined;
  operationModel.value = undefined;
  current.value = undefined;
});
</script>

<template>
  <DynamicCrudPage
    :key="metadataContext"
    ref="definitionList"
    :config="managementConfig"
  >
    <template #row-actions="{ record }">
      <RouterLink
        v-if="
          record.enabled &&
          Number(record.syncedVersion) > 0 &&
          !record.requiresNamingMigration
        "
        :to="{
          path: '/clob/V1/DataModelRecord',
          query: { modelKey: record.key },
        }"
      >
        打开页面
      </RouterLink>
    </template>
  </DynamicCrudPage>

  <Modal
    v-model:open="namingOpen"
    title="升级字段命名"
    :width="800"
    :confirm-loading="namingBusy"
    :ok-button-props="{
      disabled: !namingPreview || namingPreview.risks.length > 0,
    }"
    ok-text="确认升级"
    @ok="migrateNaming"
  >
    <Spin :spinning="!namingPreview">
      <template v-if="namingPreview">
        <Alert
          type="info"
          message="升级会保留现有记录，完成后请重新打开数据页面。"
          class="mb-3"
        />
        <Alert
          v-for="risk in namingPreview.risks"
          :key="risk"
          type="error"
          :message="risk"
          class="mb-2"
        />
        <pre class="overflow-auto whitespace-pre-wrap">{{
          namingPreview.sql.join('\n')
        }}</pre>
      </template>
    </Spin>
  </Modal>

  <Modal
    v-model:open="fieldsOpen"
    title="模型字段管理"
    :width="1160"
    :confirm-loading="fieldsSaving"
    ok-text="保存字段清单"
    @ok="saveFields"
  >
    <template v-if="fieldsDraft">
      <Alert
        type="info"
        show-icon
        class="mb-3"
        message="系统字段由服务端基础实体描述生成，仅供查看；业务字段可新增、编辑和删除。"
      />
      <div class="mb-3 flex items-center gap-3">
        <Button type="primary" @click="editField()">新增字段</Button>
        <span>定义版本 {{ fieldsDraft.expectedVersion }}</span>
        <span>保存时一次提交完整业务字段与数据权限组。</span>
      </div>
      <Collapse class="mb-3">
        <Collapse.Panel key="permission-groups" header="数据权限组">
          <div class="mb-2">
            <Button @click="editGroup()">新建权限组</Button>
          </div>
          <Table
            :columns="groupColumns"
            :data-source="fieldsDraft.permissionGroups || []"
            row-key="key"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, index }">
              <template v-if="column.key === 'groupActions'">
                <Button type="link" @click="editGroup(index)">编辑</Button>
                <Popconfirm
                  title="移除该权限组？仍被字段引用时会拒绝。"
                  @confirm="removeGroup(index)"
                >
                  <Button danger type="link">移除</Button>
                </Popconfirm>
              </template>
            </template>
          </Table>
        </Collapse.Panel>
      </Collapse>
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span>字段来源</span>
          <Select
            v-model:value="fieldSourceFilter"
            class="w-44"
            :options="[
              { label: '业务字段', value: 'BUSINESS' },
              { label: '全部字段', value: 'ALL' },
              { label: '模型属性', value: 'MODEL_ATTRIBUTE' },
              { label: '记录系统列', value: 'RECORD_SYSTEM' },
            ]"
          />
          <span class="text-gray-500">
            业务字段 {{ fieldsDraft.fields.length }} 项
          </span>
        </div>
        <span class="text-gray-500">用途：查 / 列 / 新 / 改 / 详</span>
      </div>
      <Table
        :columns="fieldColumns"
        :data-source="fieldRows"
        row-key="key"
        class="data-model-field-table"
        :pagination="{ pageSize: 10, showSizeChanger: false }"
        :scroll="{ x: 1300 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'source'">
            <Tag :color="record.source === 'BUSINESS' ? 'blue' : 'default'">
              {{ fieldSourceLabel(record.source) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'permissionGroup'">
            {{
              record.source === 'BUSINESS'
                ? groupTitle(record.permissionGroupKey)
                : '系统保护'
            }}
          </template>
          <template v-else-if="column.key === 'usage'">
            <span
              :title="
                record.source === 'BUSINESS'
                  ? fieldUsageDescription(record as DataModelField)
                  : '固定系统字段'
              "
            >
              {{
                record.source === 'BUSINESS'
                  ? fieldUsageSummary(record as DataModelField)
                  : '固定'
              }}
            </span>
          </template>
          <template v-else-if="column.key === 'fieldActions'">
            <Button
              v-if="record.source === 'BUSINESS'"
              type="link"
              @click="editField(Number(record.businessIndex))"
            >
              编辑
            </Button>
            <span v-else class="text-gray-500">只读</span>
            <Popconfirm
              v-if="record.source === 'BUSINESS'"
              title="从业务字段定义中移除？已同步物理列不会由普通同步自动删除。"
              @confirm="removeField(Number(record.businessIndex))"
            >
              <Button type="link" danger>删除</Button>
            </Popconfirm>
          </template>
        </template>
      </Table>
    </template>
  </Modal>

  <Modal
    v-model:open="rowEditorOpen"
    :title="rowIndex < 0 ? '新增业务字段' : '编辑业务字段'"
    :width="960"
    ok-text="确定"
    @ok="saveFieldRow"
  >
    <Form
      v-if="rowDraft"
      id="data-model-business-field-edit"
      name="dataModelBusinessFieldEdit"
      data-form-id="data-model-business-field-edit"
      data-form-name="编辑业务字段"
      layout="vertical"
    >
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Form.Item label="稳定字段标识">
          <Input v-model:value="rowDraft.key" :disabled="rowIndex >= 0" />
        </Form.Item>
        <Form.Item label="字段名">
          <Input v-model:value="rowDraft.name" />
        </Form.Item>
        <Form.Item label="标题">
          <Input v-model:value="rowDraft.title" />
        </Form.Item>
        <Form.Item label="类型">
          <Select
            :value="rowDraft.type"
            :options="fieldTypes"
            @change="
              (value) =>
                setFieldType(rowDraft!, value as DataModelField['type'])
            "
          />
        </Form.Item>
        <Form.Item label="允许为空">
          <Switch v-model:checked="rowDraft.nullable" />
        </Form.Item>
        <Form.Item label="数据权限组">
          <div class="flex gap-2">
            <Select
              :value="rowDraft.permissionGroupKey || undefined"
              allow-clear
              @update:value="
                (value) =>
                  (rowDraft!.permissionGroupKey =
                    typeof value === 'string' ? value : undefined)
              "
              :options="
                (fieldsDraft?.permissionGroups || []).map((group) => ({
                  label: group.title,
                  value: group.key,
                }))
              "
              placeholder="未分组：仅受模型操作权限"
              class="min-w-0 flex-1"
            />
            <Button @click="editGroup()">新建组</Button>
          </div>
        </Form.Item>
        <Form.Item label="列表展示">
          <Switch v-model:checked="rowDraft.listEnabled" />
        </Form.Item>
        <Form.Item label="新增表单">
          <Switch v-model:checked="rowDraft.createEnabled" />
        </Form.Item>
        <Form.Item label="编辑表单">
          <Switch v-model:checked="rowDraft.editEnabled" />
        </Form.Item>
        <Form.Item label="详情展示">
          <Switch v-model:checked="rowDraft.detailEnabled" />
        </Form.Item>
        <Form.Item label="允许查询">
          <Switch
            v-model:checked="rowDraft.queryEnabled"
            :disabled="rowDraft.type === 'JSON'"
            @update:checked="
              (value) => {
                if (value && !rowDraft?.queryOperators?.length)
                  rowDraft!.queryOperators = ['EQ'];
              }
            "
          />
        </Form.Item>
        <Form.Item v-if="rowDraft.queryEnabled" label="查询操作符">
          <Select
            v-model:value="rowDraft.queryOperators"
            mode="multiple"
            :options="
              allowedQueryOperators(rowDraft.type).map((operator) => ({
                label: queryOperatorLabels[operator],
                value: operator,
              }))
            "
          />
        </Form.Item>
        <Form.Item v-if="rowDraft.type === 'STRING'" label="长度">
          <InputNumber v-model:value="rowDraft.length" :min="1" />
        </Form.Item>
        <Form.Item
          v-if="rowDraft.type === 'DECIMAL' || rowDraft.type === 'MONEY'"
          label="精度"
        >
          <InputNumber
            v-model:value="rowDraft.precision"
            :min="1"
            :max="1000"
          />
        </Form.Item>
        <Form.Item
          v-if="rowDraft.type === 'DECIMAL' || rowDraft.type === 'MONEY'"
          label="小数位"
        >
          <InputNumber v-model:value="rowDraft.scale" :min="0" />
        </Form.Item>
        <Form.Item label="默认值">
          <Switch
            v-if="rowDraft.type === 'BOOLEAN'"
            :checked="rowDraft.defaultValue === true"
            @update:checked="rowDraft.defaultValue = $event"
          />
          <InputNumber
            v-else-if="rowDraft.type === 'INTEGER'"
            :value="
              typeof rowDraft.defaultValue === 'number'
                ? rowDraft.defaultValue
                : undefined
            "
            @update:value="rowDraft.defaultValue = $event ?? undefined"
          />
          <Input
            v-else
            :value="
              rowDraft.defaultValue == null ? '' : String(rowDraft.defaultValue)
            "
            @update:value="rowDraft.defaultValue = $event || undefined"
          />
        </Form.Item>
        <Form.Item label="选项来源">
          <Select
            v-model:value="rowDraft.optionSource"
            allow-clear
            :options="[
              { value: 'FIXED', label: '固定选项' },
              { value: 'ENUM', label: '枚举' },
              { value: 'DICT', label: '字典' },
            ]"
          />
        </Form.Item>
        <Form.Item
          v-if="
            rowDraft.optionSource === 'ENUM' || rowDraft.optionSource === 'DICT'
          "
          label="选项引用"
        >
          <Input v-model:value="rowDraft.optionRef" />
        </Form.Item>
        <Form.Item class="col-span-2" label="描述">
          <Input v-model:value="rowDraft.description" />
        </Form.Item>
      </div>
      <Form.Item
        v-if="rowDraft.optionSource === 'FIXED'"
        label="固定选项 JSON（value/label 数组）"
      >
        <Input.TextArea
          :value="rowOptionText"
          :rows="4"
          @update:value="setFixedOptions"
        />
        <div v-if="rowOptionError" class="text-red-600">
          {{ rowOptionError }}
        </div>
      </Form.Item>
    </Form>
  </Modal>

  <Modal
    v-model:open="groupEditorOpen"
    :title="groupIndex < 0 ? '新建数据权限组' : '编辑数据权限组'"
    :width="640"
    ok-text="确定"
    @ok="saveGroup"
  >
    <Form
      v-if="groupDraft"
      id="data-model-permission-group-edit"
      name="dataModelPermissionGroupEdit"
      data-form-id="data-model-permission-group-edit"
      data-form-name="编辑数据权限组"
      layout="vertical"
    >
      <Form.Item label="稳定标识" required>
        <Input v-model:value="groupDraft.key" :disabled="groupIndex >= 0" />
      </Form.Item>
      <Form.Item label="中文标题" required>
        <Input v-model:value="groupDraft.title" />
      </Form.Item>
      <Form.Item label="说明">
        <Input v-model:value="groupDraft.description" />
      </Form.Item>
      <Form.Item label="机密级别" required>
        <Select
          v-model:value="groupDraft.confidentialLevel"
          :options="confidentialOptions"
          placeholder="选择现有 RBAC 机密级别"
        />
      </Form.Item>
    </Form>
  </Modal>

  <Modal
    v-model:open="previewOpen"
    title="数据库结构差异"
    :width="900"
    :confirm-loading="syncing"
    ok-text="同步安全变更"
    :ok-button-props="{
      disabled: !preview || preview.risks.length > 0 || !allowed('sync'),
    }"
    @ok="sync"
  >
    <template v-if="preview">
      <Alert
        :type="preview.risks.length > 0 ? 'warning' : 'info'"
        show-icon
        :message="
          preview.risks.length > 0
            ? '存在高风险差异，需另行人工迁移'
            : '可同步的安全变更'
        "
      />
      <p class="mt-3">
        定义版本：{{ preview.definitionVersion }}；指纹：{{
          preview.fingerprint
        }}
      </p>
      <pre class="max-h-80 overflow-auto rounded bg-gray-100 p-3">{{
        preview.sql.join('\n') || '无结构变化'
      }}</pre>
      <ul>
        <li v-for="risk in preview.risks" :key="risk">{{ risk }}</li>
      </ul>
    </template>
  </Modal>
  <Modal
    v-model:open="operationsOpen"
    title="模型接口管理"
    :width="1150"
    :footer="null"
  >
    <Spin :spinning="operationsLoading">
      <OperationsManager
        v-if="operationModel"
        :model="operationModel"
        :editable="allowed('saveOperations')"
        @saved="
          (model) => {
            operationModel = model;
            void load();
          }
        "
      />
      <h3 class="mb-3 mt-5">已同步执行契约</h3>
      <Alert
        type="info"
        show-icon
        class="mb-3"
        message="操作权限表达式由后端提供，页面只展示当前模型的生成契约；接口执行仍以服务端实时授权为准。"
      />
      <Collapse v-if="operationModel?.operations?.length">
        <Collapse.Panel
          v-for="operation in operationModel.operations"
          :key="operation.code"
          :header="`${operation.title}（${operation.code}）`"
        >
          <Descriptions bordered :column="2" size="small">
            <Descriptions.Item label="状态">
              {{ operation.available ? '可用' : '不可用' }}
            </Descriptions.Item>
            <Descriptions.Item label="当前授权">
              {{ operation.authorized ? '已授权' : '未授权' }}
            </Descriptions.Item>
            <Descriptions.Item label="HTTP 方法">
              {{ operation.method }}
            </Descriptions.Item>
            <Descriptions.Item label="通用接口">
              {{ operation.path }}
            </Descriptions.Item>
            <Descriptions.Item label="权限表达式" :span="2">
              {{ operation.permissionExpr }}
            </Descriptions.Item>
          </Descriptions>
          <h4 class="my-3">请求参数</h4>
          <p v-if="operation.code === 'QUERY'" class="mb-2 text-gray-500">
            查询值通过固定参数名写入 queryValues，查询语义已在接口定义中固定。
          </p>
          <Table
            :columns="parameterColumns"
            :data-source="operation.requestParams"
            row-key="name"
            size="small"
            :pagination="false"
            :scroll="{ x: 1450 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'nullable'">
                {{ record.nullable ? '是' : '否' }}
              </template>
              <template v-else-if="column.key === 'wirePath'">
                {{ record.wirePath || record.name }}
              </template>
              <template v-else-if="column.key === 'serverManaged'">
                {{ record.serverManaged ? '是' : '否' }}
              </template>
              <template v-else-if="column.key === 'controlledFilter'">
                {{ record.controlledFilter ? '是' : '否' }}
              </template>
              <template v-else-if="column.key === 'operators'">
                {{ record.operators?.join('、') || '—' }}
              </template>
              <template v-else-if="column.key === 'defaultValue'">
                {{
                  record.defaultValue === undefined
                    ? '—'
                    : JSON.stringify(record.defaultValue)
                }}
              </template>
              <template v-else-if="column.key === 'options'">
                {{
                  record.options?.length ? JSON.stringify(record.options) : '—'
                }}
              </template>
            </template>
          </Table>
          <h4 class="my-3">响应参数</h4>
          <Table
            :columns="parameterColumns"
            :data-source="operation.responseParams"
            row-key="name"
            size="small"
            :pagination="false"
            :scroll="{ x: 1450 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'nullable'">
                {{ record.nullable ? '是' : '否' }}
              </template>
              <template v-else-if="column.key === 'wirePath'">
                {{ record.wirePath || record.name }}
              </template>
              <template v-else-if="column.key === 'serverManaged'">
                {{ record.serverManaged ? '是' : '否' }}
              </template>
              <template v-else-if="column.key === 'controlledFilter'">
                {{ record.controlledFilter ? '是' : '否' }}
              </template>
              <template v-else-if="column.key === 'operators'">
                {{ record.operators?.join('、') || '—' }}
              </template>
              <template v-else-if="column.key === 'defaultValue'">
                {{
                  record.defaultValue === undefined
                    ? '—'
                    : JSON.stringify(record.defaultValue)
                }}
              </template>
              <template v-else-if="column.key === 'options'">
                {{
                  record.options?.length ? JSON.stringify(record.options) : '—'
                }}
              </template>
            </template>
          </Table>
        </Collapse.Panel>
      </Collapse>
      <Alert
        v-else-if="!operationsLoading"
        type="info"
        message="该模型尚无已同步的标准操作"
      />
    </Spin>
  </Modal>
</template>

<style scoped>
.data-model-field-table :deep(.ant-table-thead > tr > th),
.data-model-field-table :deep(.ant-table-tbody > tr > td) {
  white-space: nowrap;
  vertical-align: middle;
}
</style>
