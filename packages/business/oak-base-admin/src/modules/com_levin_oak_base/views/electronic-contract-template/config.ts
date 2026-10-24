import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { electronicContractTemplateService } from '../../api/electronic-contract-template-service';
import { standardCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  userOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);
const statusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.EContractTemplate$Status',
);

// 变量定义只允许模板声明的文本占位符，不执行脚本或表达式。
const variableSchema = {
  type: 'array',
  title: '模板变量',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['key', 'title'],
    properties: {
      key: {
        type: 'string',
        title: '变量名',
        description: '对应 Word 中的 {{变量名}}',
      },
      title: { type: 'string', title: '填写提示' },
      required: { type: 'boolean', title: '必填' },
    },
  },
} as const;

export const pageMeta = {
  name: 'ElectronicContractTemplate',
  title: '电子合同模板',
  description: '维护电子合同模板。',
} as const;

export const electronicContractTemplatePageCrudConfig: CrudPageConfig =
  withModuleCrudConfig({
    apiBase: '/EContractTemplate',
    apiService: electronicContractTemplateService,
    dataAttrTargets: standardCrudDataAttrTargets(
      electronicContractTemplateService,
    ),
    domainObject: true,
    allowCreate: true,
    allowDelete: false,
    editVisibleOn: "status == 'Draft'",
    defaultFormValues: { templateFieldSchema: [] },
    // 受控上传结果写入表单状态；保存时只提交当前创建接口的字段。
    transformSubmit: (values, record) => {
      if (record) return values;
      if (!values.fileResId || !values.fileName || !values.fileUrl) {
        throw new Error('请先上传受控 DOCX 模板');
      }
      const schema =
        typeof values.templateFieldSchema === 'string'
          ? JSON.parse(values.templateFieldSchema)
          : values.templateFieldSchema;
      if (!Array.isArray(schema)) throw new Error('模板变量必须是数组');
      return {
        tenantId: values.tenantId,
        orgId: values.orgId,
        ownerId: values.ownerId,
        templateNo: values.templateNo,
        name: values.name,
        category: values.category,
        confidentialLevel: values.confidentialLevel,
        fileResId: values.fileResId,
        fileName: values.fileName,
        fileUrl: values.fileUrl,
        fileHash: values.fileHash,
        mimeType: values.mimeType,
        templateFieldSchema: schema,
        sealPositionRules: values.sealPositionRules,
      };
    },
    fields: [
      {
        key: 'tenantId',
        label: '归属租户',
        loadOptions: tenantOptionsLoader,
        remoteSearch: true,
        search: true,
        type: 'select',
        visibleForPlatformUser: true,
      },
      { key: 'orgId', label: '所属组织', type: 'org-tree-select' },
      {
        key: 'ownerId',
        label: '所属用户',
        loadOptions: userOptionsLoader,
        remoteSearch: true,
        type: 'select',
      },
      { key: 'id', label: '模板ID', form: false, search: true },
      {
        key: 'containsTemplateNo',
        label: '模板编号',
        form: false,
        search: true,
      },
      {
        key: 'templateNo',
        label: '模板编号',
        required: true,
        table: true,
        width: 180,
      },
      {
        key: 'name',
        label: '模板名称',
        required: true,
        search: true,
        table: true,
        width: 220,
      },
      {
        key: 'category',
        label: '类别',
        required: true,
        table: true,
        width: 140,
      },
      {
        key: 'confidentialLevel',
        label: '机密等级',
        loadOptions: confidentialLevelOptionsLoader,
        type: 'select',
        valueType: 'number',
      },
      {
        key: 'fileResId',
        label: 'Word 模板文件',
        required: true,
        formCreate: true,
        formEdit: false,
        detail: true,
      },
      {
        key: 'fileName',
        label: '模板文件名',
        required: true,
        formCreate: true,
        formEdit: false,
      },
      {
        key: 'fileUrl',
        label: '受控模板文件路径',
        required: true,
        formCreate: true,
        formEdit: false,
      },
      {
        key: 'fileHash',
        label: '模板文件哈希',
        formCreate: true,
        formEdit: false,
      },
      {
        key: 'mimeType',
        label: '模板文件类型',
        formCreate: true,
        formEdit: false,
      },
      {
        key: 'templateFieldSchema',
        label: '模板变量定义',
        type: 'json',
        jsonSchema: variableSchema,
        jsonSchemaMode: 'popup',
      },
      {
        key: 'sealPositionRules',
        label: '默认签章位置规则',
        type: 'json',
      },
      {
        key: 'status',
        label: '模板状态',
        form: false,
        loadOptions: statusOptionsLoader,
        search: true,
        table: true,
        type: 'select',
        width: 120,
      },
      {
        key: 'createTime',
        label: '创建时间',
        form: false,
        table: true,
        type: 'datetime',
        width: 180,
      },
    ],
    rowActions: [
      {
        label: '上线',
        handler: (record) =>
          electronicContractTemplateService.publish({
            id: record.id,
            tenantId: record.tenantId,
            orgId: record.orgId,
            ownerId: record.ownerId,
          }),
        permission: buildApiMethodPermissions(
          electronicContractTemplateService,
          'publish',
        ),
        visibleOn: "status == 'Draft'",
        flowFormFields: [],
      },
      {
        label: '归档',
        handler: (record) =>
          electronicContractTemplateService.archive({
            id: record.id,
            tenantId: record.tenantId,
            orgId: record.orgId,
            ownerId: record.ownerId,
          }),
        permission: buildApiMethodPermissions(
          electronicContractTemplateService,
          'archive',
        ),
        visibleOn: "status == 'Published'",
        flowFormFields: [],
      },
    ],
    modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
    title: '电子合同模板',
  });
