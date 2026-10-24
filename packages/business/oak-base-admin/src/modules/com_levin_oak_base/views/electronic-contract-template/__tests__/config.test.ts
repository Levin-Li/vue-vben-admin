import { describe, expect, it, vi } from 'vitest';

import { electronicContractTemplatePageCrudConfig } from '../config';

vi.mock('../../../api/electronic-contract-template-service', () => ({
  electronicContractTemplateService: {},
}));
vi.mock('../../api-module', () => ({
  buildEnumOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
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
      templateFieldSchema: [{ key: 'amount', title: '金额' }],
    });
    expect(payload).not.toHaveProperty('status');
  });

  it('缺少受控上传结果时拒绝保存', () => {
    expect(() =>
      electronicContractTemplatePageCrudConfig.transformSubmit?.(
        { templateNo: 'T-1', name: '销售合同', category: '销售' },
        null,
      ),
    ).toThrow('请先上传受控 DOCX 模板');
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
