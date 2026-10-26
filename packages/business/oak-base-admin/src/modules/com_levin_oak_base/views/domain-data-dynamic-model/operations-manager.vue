<script setup lang="ts">
import type {
  DataModelActionType,
  DataModelDefinition,
  DataModelOperationDefinition,
  DataModelOperationParameter,
} from '../../api/data-model-service';

import { computed, ref, watch } from 'vue';

import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { dataModelService } from '../../api/data-model-service';
import { recordFailure } from '../data-model-record/record-errors';
import {
  serializeRecordValue,
  toDatetimeLocal,
} from '../data-model-record/record-fields';
import { cloneDataModelDto } from './field-table';
import { queryOperatorLabels } from './field-usage';
import {
  derivedQueryColumn,
  validateQueryInputMapping,
  withQueryMappingCandidate,
} from './query-input-mapping';

const props = defineProps<{ editable: boolean; model: DataModelDefinition }>();
const emit = defineEmits<{ saved: [model: DataModelDefinition] }>();
const operations = ref<DataModelOperationDefinition[]>([]);
const saving = ref(false);
const editorOpen = ref(false);
const draft = ref<DataModelOperationDefinition>();
const editingIndex = ref(-1);
const customKey = ref('');
const assignments = ref<Array<{ field: string; value: unknown }>>([]);
const invalidJson = ref<Record<string, boolean>>({});
const requestJson = ref('{}');
const responseJson = ref('{}');
const requestJsonTouched = ref(false);
const responseJsonTouched = ref(false);
const columns = [
  { title: '接口名称', dataIndex: 'title' },
  { title: '动作标识', dataIndex: 'code' },
  { title: '分类', key: 'kind' },
  { title: '动作类型', key: 'actionType' },
  { title: 'HTTP 方法', key: 'httpMethod' },
  { title: '请求路径', key: 'requestPath' },
  { title: '级别', key: 'target' },
  { title: '启用', key: 'enabled' },
  { title: '操作', key: 'actions' },
];
const queryColumns = [
  { title: '查询参数键', key: 'key', width: 180 },
  { title: '目标字段', key: 'field' },
  { title: '数据库列（派生）', key: 'column', width: 170 },
  { title: '中文名称', key: 'title' },
  { title: '固定操作符', key: 'operator' },
  { title: '默认显示', key: 'visible' },
  { title: '操作', key: 'actions' },
];
const assignmentColumns = [
  { title: '业务字段', key: 'field' },
  { title: '固定值', key: 'value' },
  { title: '操作', key: 'actions' },
];
watch(
  () => [props.model.key, props.model.version],
  () => {
    operations.value = cloneDataModelDto(
      props.model.operationDefinitions || [],
    );
  },
  { immediate: true },
);

function isCustom(operation: DataModelOperationDefinition) {
  return (
    operation.classification === 'EXTENSION' ||
    (!operation.classification &&
      !operation.standardAction &&
      operation.code.startsWith('CUSTOM_'))
  );
}
function kindLabel(operation: DataModelOperationDefinition) {
  return isCustom(operation) ? '扩展' : '标准';
}
const actionTypeLabels: Record<DataModelActionType, string> = {
  QUERY: '查询',
  DETAIL: '详情',
  CREATE: '创建',
  UPDATE: '修改',
  DELETE: '删除',
  SET_ENABLED: '启停',
  EXTENSION_CREATE: '扩展创建',
  EXTENSION_UPDATE: '扩展修改',
  EXECUTE: '旧扩展动作',
};
function actionType(
  operation: DataModelOperationDefinition,
): DataModelActionType {
  // 旧扩展接口可能仍返回 CREATE、UPDATE 或 EXECUTE；按执行目标归一到新契约。
  if (isCustom(operation)) {
    return operation.executionType === 'CREATE_RECORD' ||
      operation.target === 'OBJECT'
      ? 'EXTENSION_CREATE'
      : 'EXTENSION_UPDATE';
  }
  if (operation.actionType) return operation.actionType;
  if (operation.code === 'EDIT') return 'UPDATE';
  if (operation.code in actionTypeLabels)
    return operation.code as DataModelActionType;
  return 'UPDATE';
}
function runtimeOperation(operation: DataModelOperationDefinition) {
  return props.model.operations?.find((item) => item.code === operation.code);
}
function httpMethod(operation: DataModelOperationDefinition) {
  return (
    operation.httpMethod ||
    runtimeOperation(operation)?.httpMethod ||
    runtimeOperation(operation)?.method ||
    '同步后生成'
  );
}
function requestPath(operation: DataModelOperationDefinition) {
  return (
    operation.requestPath ||
    runtimeOperation(operation)?.requestPath ||
    runtimeOperation(operation)?.path ||
    '同步后生成'
  );
}
function contractJson(
  definition: Record<string, unknown> | undefined,
  fields: string[],
  queryInputs?: DataModelOperationDefinition['queryInputs'],
) {
  return JSON.stringify(
    {
      ...definition,
      fields,
      ...(queryInputs ? { queryInputs } : {}),
    },
    null,
    2,
  );
}
function parseContract(text: string, label: string) {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object')
      throw new Error('契约必须是 JSON 对象');
    const definition = value as Record<string, unknown>;
    if (
      !Array.isArray(definition.fields) ||
      !definition.fields.every((field) => typeof field === 'string')
    )
      throw new Error('fields 必须是字符串数组');
    return definition;
  } catch {
    message.error(`${label}必须是包含字符串 fields 数组的 JSON 对象`);
    return undefined;
  }
}
const requestCandidates = computed(() =>
  (draft.value?.requestFieldOptions || []).filter(
    (field) => !field.serverManaged && !field.readOnly,
  ),
);
const responseCandidates = computed(
  () => draft.value?.responseFieldOptions || [],
);
const queryCandidates = computed(() => draft.value?.queryInputOptions || []);
const assignmentCandidates = computed(() =>
  requestCandidates.value.filter((field) => field.source === 'BUSINESS'),
);
function fieldOptions(fields: DataModelOperationParameter[]) {
  return fields.map((field) => ({ value: field.name, label: field.title }));
}
function assignmentField(name: string) {
  return assignmentCandidates.value.find((field) => field.name === name);
}
function optionToken(value: unknown) {
  return `${typeof value}:${String(value)}`;
}

function edit(index: number) {
  const operation = operations.value[index];
  if (!operation || !props.editable) return;
  editingIndex.value = index;
  draft.value = cloneDataModelDto(operation);
  requestJson.value = contractJson(
    operation.requestDefinition,
    operation.requestFields,
    operation.queryInputs,
  );
  responseJson.value = contractJson(
    operation.responseDefinition,
    operation.responseFields,
  );
  requestJsonTouched.value = false;
  responseJsonTouched.value = false;
  customKey.value = operation.code.replace(/^CUSTOM_/, '');
  assignments.value = Object.entries(operation.assignments || {}).map(
    ([field, value]) => ({
      field,
      value:
        assignmentField(field)?.type === 'DATETIME'
          ? toDatetimeLocal(value)
          : value,
    }),
  );
  invalidJson.value = {};
  editorOpen.value = true;
}
function addCustom() {
  if (!props.editable) return;
  editingIndex.value = -1;
  const base = operations.value.find((operation) => operation.code === 'EDIT');
  draft.value = {
    code: 'CUSTOM_',
    classification: 'EXTENSION',
    actionType: 'EXTENSION_UPDATE',
    title: '',
    target: 'RECORD',
    executionType: 'UPDATE_FIELDS',
    enabled: true,
    requestFields: [],
    responseFields: [],
    assignments: {},
    requestFieldOptions: cloneDataModelDto(base?.requestFieldOptions || []),
    responseFieldOptions: cloneDataModelDto(base?.responseFieldOptions || []),
  };
  requestJson.value = contractJson(undefined, []);
  responseJson.value = contractJson(undefined, []);
  requestJsonTouched.value = false;
  responseJsonTouched.value = false;
  customKey.value = '';
  assignments.value = [];
  invalidJson.value = {};
  editorOpen.value = true;
}
function changeTarget(target: unknown) {
  if (target !== 'OBJECT' && target !== 'RECORD') return;
  if (!draft.value || editingIndex.value >= 0) return;
  draft.value.target = target;
  draft.value.executionType =
    target === 'OBJECT' ? 'CREATE_RECORD' : 'UPDATE_FIELDS';
  draft.value.actionType =
    target === 'OBJECT' ? 'EXTENSION_CREATE' : 'EXTENSION_UPDATE';
  const base = operations.value.find(
    (operation) => operation.code === (target === 'OBJECT' ? 'CREATE' : 'EDIT'),
  );
  draft.value.requestFieldOptions = cloneDataModelDto(
    base?.requestFieldOptions || [],
  );
  draft.value.responseFieldOptions = cloneDataModelDto(
    base?.responseFieldOptions || [],
  );
  draft.value.requestFields = [];
  draft.value.responseFields = [];
  assignments.value = [];
}
function changeQueryOperator(index: number, operator: string) {
  const input = draft.value?.queryInputs?.[index];
  if (!input) return;
  const candidate = queryCandidates.value.find(
    (item) => item.field === input.field && item.operator === operator,
  );
  if (!candidate) return;
  draft.value!.queryInputs![index] = withQueryMappingCandidate(
    input,
    cloneDataModelDto(candidate),
  );
}
function addQuery() {
  if (!draft.value) return;
  const candidate = queryCandidates.value.find(
    (input) =>
      !draft.value?.queryInputs?.some((selected) => selected.key === input.key),
  );
  if (candidate)
    (draft.value.queryInputs ||= []).push(cloneDataModelDto(candidate));
}
function queryFields() {
  return [
    ...new Map(
      queryCandidates.value.map((input) => [
        input.field,
        {
          value: input.field,
          label:
            props.model.fields.find((field) => field.name === input.field)
              ?.title ||
            props.model.systemFields?.find(
              (field) =>
                field.source === 'RECORD_SYSTEM' && field.name === input.field,
            )?.title ||
            input.title,
        },
      ]),
    ).values(),
  ];
}
function queryOperators(field: string) {
  return [
    ...new Set(
      queryCandidates.value
        .filter((input) => input.field === field)
        .map((input) => input.operator),
    ),
  ].map((operator) => ({
    value: operator,
    label: queryOperatorLabels[operator],
  }));
}
function changeQueryField(index: number, field: string) {
  const candidate = queryCandidates.value.find(
    (input) => input.field === field,
  );
  const selected = draft.value?.queryInputs?.[index];
  if (candidate && selected)
    draft.value!.queryInputs![index] = withQueryMappingCandidate(
      selected,
      cloneDataModelDto(candidate),
    );
}
function addAssignment() {
  const candidate = assignmentCandidates.value.find(
    (field) =>
      !assignments.value.some((assignment) => assignment.field === field.name),
  );
  if (candidate)
    assignments.value.push({
      field: candidate.name,
      value:
        candidate.defaultValue ?? (candidate.type === 'BOOLEAN' ? false : ''),
    });
}
function changeAssignment(index: number, name: string) {
  const current = assignments.value[index];
  const field = assignmentField(name);
  if (current && field) {
    delete invalidJson.value[current.field];
    current.field = name;
    current.value =
      field.defaultValue ?? (field.type === 'BOOLEAN' ? false : '');
  }
}
function setChoice(index: number, token: unknown) {
  const row = assignments.value[index];
  if (row)
    row.value = assignmentField(row.field)?.options?.find(
      (option) => optionToken(option.value) === token,
    )?.value;
}

// 管理界面只保存声明配置，稳定动作身份、系统字段及所有类型校验仍由服务端强制。
function apply() {
  if (!draft.value || !props.editable) return;
  const operation = cloneDataModelDto(draft.value);
  // JSON 契约为最终提交来源；未手改 JSON 时同步现有字段选择和查询配置。
  const requestDefinition = parseContract(
    requestJsonTouched.value
      ? requestJson.value
      : contractJson(
          operation.requestDefinition,
          operation.requestFields,
          operation.queryInputs,
        ),
    '请求定义',
  );
  const responseDefinition = parseContract(
    responseJsonTouched.value
      ? responseJson.value
      : contractJson(operation.responseDefinition, operation.responseFields),
    '响应定义',
  );
  if (!requestDefinition || !responseDefinition) return;
  operation.requestDefinition = requestDefinition;
  operation.responseDefinition = responseDefinition;
  operation.requestFields = requestDefinition.fields as string[];
  operation.responseFields = responseDefinition.fields as string[];
  if (Array.isArray(requestDefinition.queryInputs)) {
    operation.queryInputs =
      requestDefinition.queryInputs as DataModelOperationDefinition['queryInputs'];
  }
  operation.classification = isCustom(operation) ? 'EXTENSION' : 'STANDARD';
  operation.actionType = actionType(operation);
  if (!operation.title.trim()) {
    message.error('请填写接口名称');
    return;
  }
  if (editingIndex.value < 0) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(customKey.value)) {
      message.error(
        '自定义动作标识须以小写字母开头，仅含小写字母、数字和下划线',
      );
      return;
    }
    operation.code = `CUSTOM_${customKey.value}`;
    if (operations.value.some((item) => item.code === operation.code)) {
      message.error('动作标识重复');
      return;
    }
  }
  if (operation.code === 'QUERY') {
    const mappingError = validateQueryInputMapping(operation.queryInputs || []);
    if (mappingError) {
      message.error(mappingError);
      return;
    }
  }
  if (isCustom(operation)) {
    if (assignments.value.length === 0) {
      message.error('请至少定义一个固定赋值');
      return;
    }
    if (Object.values(invalidJson.value).some(Boolean)) {
      message.error('请修正固定赋值的 JSON');
      return;
    }
    const names = assignments.value.map((assignment) => assignment.field);
    if (new Set(names).size !== names.length) {
      message.error('固定赋值字段不能重复');
      return;
    }
    try {
      operation.assignments = Object.fromEntries(
        assignments.value.map((assignment) => {
          const parameter = assignmentField(assignment.field);
          const field = props.model.fields.find(
            (field) => field.name === assignment.field,
          );
          if (!parameter || !field) throw new Error('固定赋值字段无效');
          return [
            assignment.field,
            serializeRecordValue(field, assignment.value),
          ];
        }),
      );
    } catch {
      message.error('固定赋值无效，请检查字段值');
      return;
    }
    operation.requestFields =
      operation.target === 'RECORD'
        ? []
        : operation.requestFields.filter((name) => !names.includes(name));
    operation.requestDefinition = {
      ...operation.requestDefinition,
      fields: operation.requestFields,
    };
  }
  if (editingIndex.value < 0) operations.value.push(operation);
  else operations.value[editingIndex.value] = operation;
  editorOpen.value = false;
}
async function save() {
  if (!props.editable || !Number.isInteger(props.model.version)) return;
  saving.value = true;
  try {
    const model = await dataModelService.saveOperations(
      props.model.key,
      Number(props.model.version),
      operations.value.map(
        ({
          requestFieldOptions: _request,
          responseFieldOptions: _response,
          queryInputOptions: _query,
          ...operation
        }) => operation,
      ),
    );
    emit('saved', model);
    message.success('接口定义已保存，同步模型后生效');
  } catch (error) {
    message.error(recordFailure(error, '接口定义保存失败，请刷新模型后重试'));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Alert
    class="mb-3"
    type="info"
    show-icon
    message="接口决定请求和返回字段；界面展示设置只能在这些字段范围内调整显示。保存后需同步模型。"
  />
  <div v-if="editable" class="mb-3 flex gap-2">
    <Button @click="addCustom">新增自定义动作</Button>
    <Button type="primary" :loading="saving" @click="save">
      保存接口定义
    </Button>
  </div>
  <Table
    :columns="columns"
    :data-source="operations"
    row-key="code"
    :pagination="false"
  >
    <template #bodyCell="{ column, record, index }">
      <template v-if="column.key === 'kind'">
        <Tag
          :color="
            isCustom(record as DataModelOperationDefinition) ? 'purple' : 'blue'
          "
        >
          {{ kindLabel(record as DataModelOperationDefinition) }}
        </Tag>
      </template>
      <template v-else-if="column.key === 'target'">
        {{ record.target === 'OBJECT' ? '对象级' : '记录级' }}
      </template>
      <template v-else-if="column.key === 'actionType'">
        {{
          actionTypeLabels[actionType(record as DataModelOperationDefinition)]
        }}
      </template>
      <template v-else-if="column.key === 'httpMethod'">
        {{ httpMethod(record as DataModelOperationDefinition) }}
      </template>
      <template v-else-if="column.key === 'requestPath'">
        {{ requestPath(record as DataModelOperationDefinition) }}
      </template>
      <template v-else-if="column.key === 'enabled'">
        {{ record.enabled ? '启用' : '停用' }}
      </template>
      <template v-else-if="column.key === 'actions' && editable">
        <Button type="link" @click="edit(index)">配置</Button>
        <Popconfirm
          v-if="isCustom(record as DataModelOperationDefinition)"
          title="删除后同步生效，已删除动作标识不可重用，确定继续？"
          @confirm="operations.splice(index, 1)"
        >
          <Button type="link" danger>删除</Button>
        </Popconfirm>
      </template>
    </template>
  </Table>
  <Modal
    v-model:open="editorOpen"
    :title="editingIndex < 0 ? '新增自定义接口' : '配置接口'"
    :width="1000"
    @ok="apply"
  >
    <Form
      v-if="draft"
      id="data-model-operation-edit"
      name="dataModelOperationEdit"
      data-form-id="data-model-operation-edit"
      data-form-name="新增或配置数据模型接口"
      layout="vertical"
      class="grid grid-cols-1 gap-x-4 md:grid-cols-2"
    >
      <Form.Item label="接口名称" required>
        <Input v-model:value="draft.title" />
      </Form.Item>
      <Form.Item
        v-if="isCustom(draft) || editingIndex < 0"
        label="稳定动作标识"
        required
      >
        <Input
          v-model:value="customKey"
          :disabled="editingIndex >= 0"
          addon-before="CUSTOM_"
        />
      </Form.Item>
      <Form.Item label="操作级别">
        <Select
          :value="draft.target"
          :disabled="editingIndex >= 0 || !!draft.standardAction"
          :options="[
            { value: 'RECORD', label: '记录级：固定更新业务字段' },
            { value: 'OBJECT', label: '对象级：创建预设记录' },
          ]"
          @update:value="changeTarget"
        />
      </Form.Item>
      <Form.Item label="接口分类">
        <Input :value="kindLabel(draft)" disabled />
      </Form.Item>
      <Form.Item label="动作类型">
        <Input :value="actionTypeLabels[actionType(draft)]" disabled />
      </Form.Item>
      <Form.Item label="HTTP 方法">
        <Input
          :value="isCustom(draft) ? draft.httpMethod || '' : httpMethod(draft)"
          :disabled="!isCustom(draft)"
          placeholder="由服务端校验并生成"
          @update:value="draft.httpMethod = String($event).toUpperCase()"
        />
      </Form.Item>
      <Form.Item label="请求路径">
        <Input
          :value="
            isCustom(draft) ? draft.requestPath || '' : requestPath(draft)
          "
          :disabled="!isCustom(draft)"
          placeholder="由服务端校验并生成"
          @update:value="draft.requestPath = String($event)"
        />
      </Form.Item>
      <Form.Item label="是否启用">
        <Switch v-model:checked="draft.enabled" />
      </Form.Item>
      <Form.Item label="确认提示">
        <Input v-model:value="draft.confirmText" />
      </Form.Item>
      <Form.Item
        v-if="
          draft.code !== 'QUERY' &&
          (!isCustom(draft) || draft.target === 'OBJECT')
        "
        label="允许填写的请求字段"
      >
        <Select
          v-model:value="draft.requestFields"
          mode="multiple"
          :options="
            fieldOptions(requestCandidates).filter(
              (field) =>
                !assignments.some(
                  (assignment) => assignment.field === field.value,
                ),
            )
          "
        />
      </Form.Item>
      <Form.Item label="返回字段">
        <Select
          v-model:value="draft.responseFields"
          mode="multiple"
          :options="fieldOptions(responseCandidates)"
        />
      </Form.Item>
      <!-- 请求与响应使用 JSON 对象持久化；现有字段选择仍作为便捷编辑入口。 -->
      <Form.Item class="col-span-full" label="请求定义 JSON">
        <Input.TextArea
          :value="
            requestJsonTouched
              ? requestJson
              : contractJson(
                  draft.requestDefinition,
                  draft.requestFields,
                  draft.queryInputs,
                )
          "
          :rows="5"
          @update:value="
            requestJson = String($event);
            requestJsonTouched = true;
          "
        />
      </Form.Item>
      <Form.Item class="col-span-full" label="响应定义 JSON">
        <Input.TextArea
          :value="
            responseJsonTouched
              ? responseJson
              : contractJson(draft.responseDefinition, draft.responseFields)
          "
          :rows="4"
          @update:value="
            responseJson = String($event);
            responseJsonTouched = true;
          "
        />
      </Form.Item>
      <template v-if="draft.code === 'QUERY'">
        <div class="col-span-full mb-2 flex items-center justify-between">
          <strong>查询参数映射：参数键 → 模型字段 → 比较符 → 数据库列</strong>
          <Button @click="addQuery">添加查询参数</Button>
        </div>
        <Table
          class="col-span-full"
          :columns="queryColumns"
          :data-source="draft.queryInputs || []"
          row-key="key"
          :pagination="false"
          :scroll="{ x: 900 }"
        >
          <template #bodyCell="{ column, record, index }">
            <Input
              v-if="column.key === 'key'"
              v-model:value="record.key"
              placeholder="如 minimumAmount"
            />
            <Select
              v-else-if="column.key === 'field'"
              :value="record.field"
              :options="queryFields()"
              class="w-40"
              @update:value="
                (value) => changeQueryField(index, value as string)
              "
            />
            <span v-else-if="column.key === 'column'" class="font-mono">
              {{ derivedQueryColumn(record.field) }}
            </span>
            <Input
              v-else-if="column.key === 'title'"
              v-model:value="record.title"
            />
            <Select
              v-else-if="column.key === 'operator'"
              :value="record.operator"
              :options="queryOperators(record.field)"
              class="w-32"
              @update:value="
                (value) => changeQueryOperator(index, value as string)
              "
            />
            <Switch
              v-else-if="column.key === 'visible'"
              v-model:checked="record.defaultVisible"
            />
            <Button
              v-else-if="column.key === 'actions'"
              type="link"
              danger
              @click="draft.queryInputs?.splice(index, 1)"
            >
              移除
            </Button>
          </template>
        </Table>
      </template>
      <template v-if="isCustom(draft) || editingIndex < 0">
        <div class="col-span-full mb-2 flex items-center justify-between">
          <strong>固定字段赋值</strong>
          <Button @click="addAssignment">添加赋值</Button>
        </div>
        <Table
          class="col-span-full"
          :columns="assignmentColumns"
          :data-source="assignments"
          row-key="field"
          :pagination="false"
        >
          <template #bodyCell="{ column, record, index }">
            <Select
              v-if="column.key === 'field'"
              :value="record.field"
              :options="fieldOptions(assignmentCandidates)"
              class="w-48"
              @update:value="
                (value) => changeAssignment(index, value as string)
              "
            />
            <template v-else-if="column.key === 'value'">
              <Select
                v-if="assignmentField(record.field)?.options?.length"
                :value="optionToken(record.value)"
                :options="
                  assignmentField(record.field)?.options?.map((option) => ({
                    label: option.label,
                    value: optionToken(option.value),
                  }))
                "
                class="w-full"
                @update:value="(value) => setChoice(index, value)"
              />
              <Switch
                v-else-if="assignmentField(record.field)?.type === 'BOOLEAN'"
                v-model:checked="record.value"
              />
              <InputNumber
                v-else-if="assignmentField(record.field)?.type === 'INTEGER'"
                v-model:value="record.value"
                :precision="0"
              />
              <JsonEditorField
                v-else-if="assignmentField(record.field)?.type === 'JSON'"
                v-model="record.value"
                @validity="invalidJson[record.field] = !$event"
              />
              <input
                v-else-if="
                  ['DATE', 'TIME', 'DATETIME'].includes(
                    assignmentField(record.field)?.type || '',
                  )
                "
                v-model="record.value"
                :type="
                  assignmentField(record.field)?.type === 'DATE'
                    ? 'date'
                    : assignmentField(record.field)?.type === 'TIME'
                      ? 'time'
                      : 'datetime-local'
                "
                step="0.001"
                class="w-full rounded border px-2 py-1"
              />
              <Input
                v-else
                v-model:value="record.value"
                placeholder="输入固定值"
              />
            </template>
            <Button
              v-else-if="column.key === 'actions'"
              type="link"
              danger
              @click="
                delete invalidJson[record.field];
                assignments.splice(index, 1);
              "
            >
              移除
            </Button>
          </template>
        </Table>
      </template>
    </Form>
  </Modal>
</template>
