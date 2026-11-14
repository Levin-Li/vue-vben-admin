import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { electronicContractTemplateService } from '../../api/electronic-contract-template-service';
import { standardCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import {
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';
import { normalizeTemplateVariables } from './template-variables';

const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);
const statusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.EContractTemplate$Status',
);
const categoryOptionsLoader = buildDictOptionsLoader(
  'com.levin.oak.base.entities.EContract.category',
);

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
    createSubmitKeys: [
      'templateNo',
      'fileName',
      'fileUrl',
      'fileHash',
      'mimeType',
    ],
    // 受控上传结果写入表单状态；模板编号以本次资源 ID 派生，用户无需维护技术字段。
    transformSubmit: (values, record) => {
      if (record) return values;
      const uploaded =
        values.fileResId && typeof values.fileResId === 'object'
          ? values.fileResId
          : values;
      if (!uploaded.fileResId || !uploaded.fileName || !uploaded.fileUrl) {
        throw new Error('请先上传 Word 合同文件（.docx）');
      }
      const schema = normalizeTemplateVariables(values.templateFieldSchema);
      return {
        tenantId: values.tenantId,
        orgId: values.orgId,
        ownerId: values.ownerId,
        templateNo:
          String(values.templateNo || '').trim() || `CT-${uploaded.fileResId}`,
        name: String(values.name || '').trim(),
        category: String(values.category || '').trim(),
        confidentialLevel: values.confidentialLevel,
        fileResId: uploaded.fileResId,
        fileName: uploaded.fileName,
        fileUrl: uploaded.fileUrl,
        fileHash: uploaded.fileHash,
        mimeType: uploaded.mimeType,
        templateFieldSchema: schema,
        sealPositionRules: values.sealPositionRules,
      };
    },
    // 单独声明详情字段，保留表格、查询和提交配置。
    detailExtraFields: [
      {
        key: 'tenantName',
        label: '租户名称',
        detail: false,
      },
      {
        key: 'orgName',
        label: '组织名称',
        detail: false,
      },
      {
        key: 'ownerName',
        label: '拥有者名称',
      },
      {
        key: 'owner',
        label: '所有者',
        detail: false,
      },
      {
        key: 'domain',
        label: '适用域名',
      },
      {
        key: 'lastStatusTime',
        label: '最后一次状态变更时间',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 50,
        type: 'datetime',
      },
      {
        key: 'lastStatusDesc',
        label: '最后状态描述',
      },
      {
        key: 'actionLog',
        label: '流程日志',
        detail: false,
      },
      {
        key: 'supportEventsByCurrentStatus',
        label: '当前状态可执行事件列表',
        detail: false,
      },
      {
        key: 'domainId',
        label: '领域标识',
        detail: false,
      },
      {
        key: 'creator',
        label: '创建者',
        detail: false,
      },
      {
        key: 'lastUpdateTime',
        label: '更新时间',
        layoutOrder: 925,
        type: 'datetime',
      },
      {
        key: 'orderCode',
        label: '排序代码',
        layoutOrder: 900,
      },
      {
        key: 'enable',
        label: '是否启用',
        layoutOrder: 905,
        type: 'switch',
      },
      {
        key: 'editable',
        label: '是否可编辑',
        layoutOrder: 910,
        type: 'switch',
      },
      {
        key: 'remark',
        label: '备注',
        layoutOrder: 915,
      },
      {
        key: 'optimisticLock',
        label: '乐观锁版本号',
        detail: false,
      },
    ],
    fields: [
      {
        key: 'tenantId',
        label: '使用租户',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 5,
        loadOptions: tenantOptionsLoader,
        remoteSearch: true,
        search: true,
        type: 'select',
        visibleForPlatformUser: true,
      },
      {
        key: 'orgId',
        label: '使用组织',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 10,
        type: 'org-tree-select',
      },
      {
        key: 'ownerId',
        label: '所属用户',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 15,
        type: 'user-tree-select',
        defaultHidden: { create: true },
      },
      {
        key: 'fileResId',
        label: '上传 Word 合同',
        fullRow: true,
        required: true,
        formCreate: true,
        formEdit: false,
        detail: true,
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
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 30,
        formCreate: false,
        help: '新增时由系统根据上传文件自动生成。',
        table: true,
        width: 180,
      },
      {
        key: 'name',
        label: '模板名称',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 25,
        placeholder: '如：客户服务合同',
        required: true,
        search: true,
        table: true,
        width: 220,
      },
      {
        key: 'category',
        label: '合同用途',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 35,
        allowInput: true,
        loadOptions: categoryOptionsLoader,
        placeholder: '选择或输入，如：销售合同',
        required: true,
        table: true,
        type: 'select',
        width: 140,
      },
      {
        key: 'confidentialLevel',
        label: '机密等级',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 45,
        defaultHidden: { create: true },
        loadOptions: confidentialLevelOptionsLoader,
        type: 'select',
        valueType: 'number',
      },
      {
        key: 'fileName',
        label: '模板文件名',
        formCreate: false,
        formEdit: false,
      },
      {
        key: 'fileUrl',
        label: '受控模板文件路径',
        formCreate: false,
        formEdit: false,
      },
      {
        key: 'fileHash',
        label: '模板文件哈希',
        formCreate: false,
        formEdit: false,
      },
      {
        key: 'mimeType',
        label: '模板文件类型',
        formCreate: false,
        formEdit: false,
      },
      {
        key: 'templateFieldSchema',
        label: '合同里要填写的内容（可选）',
        fullRow: true,
        type: 'json',
        validator: (value) => {
          try {
            normalizeTemplateVariables(value);
          } catch (error) {
            return error instanceof Error ? error.message : '填写项格式不正确';
          }
        },
      },
      {
        key: 'sealPositionRules',
        label: '签章位置高级设置',
        defaultHidden: { create: true, edit: true },
        help: '普通模板可以暂不填写；只有明确签章位置要求时由管理员配置。',
        type: 'json',
      },
      {
        key: 'status',
        label: '模板状态',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 40,
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
        layoutOrder: 920,
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
    modalWidth: 'min(92vw, 900px)',
    title: '电子合同模板',
  });
