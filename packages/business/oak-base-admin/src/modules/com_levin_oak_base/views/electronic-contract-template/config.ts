import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { electronicContractTemplateService } from '../../api/electronic-contract-template-service';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);

export const electronicContractTemplatePageCrudConfig: CrudPageConfig =
  withModuleCrudConfig({
    apiBase: '/EContractTemplate',
    apiService: electronicContractTemplateService,
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
      { key: 'id', label: '模板ID', form: false, search: true, table: true, width: 180 },
      { key: 'containsTemplateNo', label: '模板编号', form: false, search: true },
      { key: 'templateNo', label: '模板编号', required: true, table: true, width: 180 },
      { key: 'title', label: '模板标题', required: true, search: true, table: true, width: 220 },
      { key: 'bizType', label: '业务类型', required: true, search: true, table: true, width: 140 },
      { key: 'contractCategory', label: '合同类别', table: true, width: 140 },
      { key: 'contractType', label: '合同类型', table: true, width: 160 },
      { key: 'confidentialLevel', label: '机密等级', loadOptions: confidentialLevelOptionsLoader, type: 'select', valueType: 'number', width: 130 },
      { key: 'fileName', label: '模板文件名', required: true, table: true, width: 220 },
      { key: 'fileUrl', label: '模板文件链接', required: true, span: 2 },
      { key: 'fileHash', label: '模板文件哈希', width: 180 },
      { key: 'mimeType', label: '模板文件类型', width: 180 },
      { key: 'signerRoleDefinition', label: '签署角色定义', type: 'json' },
      { key: 'defaultSealPositionRules', label: '默认签章位置规则', type: 'json' },
      { key: 'templateFieldSchema', label: '模板字段定义', type: 'json' },
      { key: 'description', label: '模板描述', type: 'textarea', span: 2 },
      { key: 'status', label: '模板状态', search: true, table: true, width: 120 },
      { key: 'versionNo', label: '版本号', table: true, width: 100 },
      { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
    ],
    modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
    title: '电子合同模板',
  });
