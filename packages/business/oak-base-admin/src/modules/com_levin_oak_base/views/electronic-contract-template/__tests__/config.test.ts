import { omitExcludedCrudFields } from '@levin/admin-framework/framework-commons/shared/crud-submit-fields';
import { describe, expect, it, vi } from 'vitest';

import { electronicContractTemplatePageCrudConfig } from '../config';

vi.mock('../../../api/electronic-contract-template-service', () => ({
  electronicContractTemplateService: {},
}));
vi.mock('../../api-module', () => ({
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  tenantOptionsLoader: async () => [],
  userOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

describe('电子合同模板 CRUD 配置', () => {
  it('标准新增表单只提交当前模板创建字段与上传元数据', async () => {
    expect(electronicContractTemplatePageCrudConfig.allowCreate).toBe(true);
    const payload =
      await electronicContractTemplatePageCrudConfig.transformSubmit?.(
        {
          templateNo: 'T-1',
          name: '销售合同',
          category: '销售',
          fileResId: 'res-1',
          fileName: 'contract.docx',
          fileUrl: '/controlled/res-1',
          templateFieldSchema: [{ key: 'amount', title: '金额' }],
          status: 'Published',
        },
        null,
      );
    expect(payload).toMatchObject({
      templateNo: 'T-1',
      fileResId: 'res-1',
      fileName: 'contract.docx',
      fileUrl: '/controlled/res-1',
      templateFieldSchema: [{ key: 'amount', title: '金额', required: false }],
    });
    expect(payload).not.toHaveProperty('status');
  });

  it('缺少受控上传结果时拒绝保存', () => {
    expect(() =>
      electronicContractTemplatePageCrudConfig.transformSubmit?.(
        { templateNo: 'T-1', name: '销售合同', category: '销售' },
        null,
      ),
    ).toThrow('请先上传 Word 合同文件');
  });

  it('普通新增自动编号并默认隐藏上传技术字段', async () => {
    const payload =
      await electronicContractTemplatePageCrudConfig.transformSubmit?.(
        {
          name: '客户服务合同',
          category: '服务合同',
          fileResId: {
            fileResId: 'res-2',
            fileName: 'service.docx',
            fileUrl: '/controlled/res-2',
            fileHash: 'sha-2',
            mimeType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
          templateFieldSchema: [],
        },
        null,
      );
    expect(payload).toMatchObject({
      templateNo: 'CT-res-2',
      fileResId: 'res-2',
      fileName: 'service.docx',
      fileUrl: '/controlled/res-2',
      templateFieldSchema: [],
    });

    const fields = electronicContractTemplatePageCrudConfig.fields;
    for (const key of [
      'templateNo',
      'fileName',
      'fileUrl',
      'fileHash',
      'mimeType',
    ]) {
      expect(fields.find((field) => field.key === key)?.formCreate).toBe(false);
    }
    expect(
      fields.find((field) => field.key === 'sealPositionRules')?.defaultHidden
        ?.create,
    ).toBe(true);
    const excluded = fields.filter(
      (field) => field.form === false || field.formCreate === false,
    );
    const submitted = omitExcludedCrudFields(
      payload || {},
      excluded,
      [],
      electronicContractTemplatePageCrudConfig.createSubmitKeys,
    );
    expect(submitted).toMatchObject({
      templateNo: 'CT-res-2',
      fileResId: 'res-2',
      fileName: 'service.docx',
      fileUrl: '/controlled/res-2',
      fileHash: 'sha-2',
    });
    expect(fields.find((field) => field.key === 'category')).toMatchObject({
      allowInput: true,
      type: 'select',
    });
    expect(
      fields.find((field) => field.key === 'templateFieldSchema')?.jsonSchema,
    ).toBeUndefined();
    const variableField = fields.find(
      (field) => field.key === 'templateFieldSchema',
    );
    expect(variableField?.validator?.([], {})).toBeUndefined();
    expect(
      variableField?.validator?.(
        [
          { key: 'buyerName', title: '买方' },
          { key: 'buyerName', title: '买方名称' },
        ],
        {},
      ),
    ).toContain('重复');
  });

  it('默认列表只显示基础列，并去掉旧模型字段', () => {
    const fields = electronicContractTemplatePageCrudConfig.fields;
    expect(
      fields.filter((field) => field.table).map((field) => field.key),
    ).toEqual(['templateNo', 'name', 'category', 'status', 'createTime']);
    expect(fields.map((field) => field.key)).not.toEqual(
      expect.arrayContaining([
        'contractCategory',
        'contractType',
        'description',
        'versionNo',
      ]),
    );
    expect(
      electronicContractTemplatePageCrudConfig.rowActions?.map(
        (action) => action.label,
      ),
    ).toEqual(['上线', '归档']);
  });
});
