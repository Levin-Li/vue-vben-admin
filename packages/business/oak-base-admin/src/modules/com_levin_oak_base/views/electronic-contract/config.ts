import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { electronicContractService } from '../../api/electronic-contract-service';
import {
  buildEnumOptionsLoader,
  buildModuleOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);
const signModeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.ElectronicContract$SignMode',
);
const templateOptionsLoader = buildModuleOptionsLoader(
  '/ElectronicContractTemplate/list',
  'title',
  'id',
);

const providerOptions = [
  { label: 'e签宝', value: 'esign' },
  { label: '法大大', value: 'fadada' },
  { label: '腾讯电子签', value: 'tencent-esign' },
];

export const electronicContractPageCrudConfig: CrudPageConfig =
  withModuleCrudConfig({
    apiBase: '/ElectronicContract',
    apiService: electronicContractService,
    createPath: '/ElectronicContract/saveDraft',
    updatePath: '/ElectronicContract/updateDraft',
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
      { key: 'id', label: '合同ID', form: false, search: true, table: true, width: 180 },
      { key: 'contractNo', label: '合同号', required: true, search: true, table: true, width: 180 },
      { key: 'requestNo', label: '请求幂等号', required: true, width: 180 },
      { key: 'title', label: '合同标题', required: true, search: true, table: true, width: 220 },
      { key: 'bizType', label: '业务类型', required: true, search: true, table: true, width: 140 },
      { key: 'bizOrderNo', label: '业务单号', search: true, table: true, width: 160 },
      { key: 'bizObjId', label: '业务对象ID', table: true, width: 160 },
      { key: 'contractCategory', label: '合同类别', table: true, width: 140 },
      { key: 'contractType', label: '合同类型', table: true, width: 160 },
      { key: 'confidentialLevel', label: '机密等级', loadOptions: confidentialLevelOptionsLoader, type: 'select', valueType: 'number', width: 130 },
      { key: 'signMode', label: '签署模式', loadOptions: signModeOptionsLoader, type: 'select', table: true, width: 120 },
      { key: 'providerCode', label: '首选供应商', loadOptions: async () => providerOptions, type: 'select', table: true, width: 130 },
      { key: 'templateId', label: '合同模板', loadOptions: templateOptionsLoader, remoteSearch: true, type: 'select', width: 220 },
      { key: 'sourceFileName', label: '原始文件名', table: true, width: 220 },
      { key: 'sourceFileUrl', label: '原始文件链接', span: 2 },
      { key: 'sourceFileHash', label: '原始文件哈希', width: 180 },
      { key: 'sourceFileMimeType', label: '原始文件类型', width: 180 },
      { key: 'expireTime', label: '签署截止时间', type: 'datetime', table: true, width: 180 },
      { key: 'contractPartySnapshot', label: '签约主体快照', type: 'json' },
      { key: 'sealPositionOverrides', label: '签章位置覆盖', type: 'json' },
      { key: 'status', label: '签署状态', search: true, table: true, width: 120, form: false },
      { key: 'providerFlowId', label: '供应商流程号', form: false, table: true, width: 180 },
      { key: 'signedFileUrl', label: '已签文件链接', form: false, table: true, width: 220 },
      { key: 'signingLog', label: '签署日志', form: false, type: 'json' },
      { key: 'remark', label: '备注', type: 'textarea', span: 2 },
      { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
    ],
    modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
    title: '电子合同',
  });
