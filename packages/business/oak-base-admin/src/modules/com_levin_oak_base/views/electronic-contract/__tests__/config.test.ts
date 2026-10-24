import { describe, expect, it, vi } from 'vitest';

import { electronicContractPageCrudConfig } from '../config';

vi.mock('../../../api/electronic-contract-service', () => ({
  electronicContractService: {},
}));

vi.mock('../../api-module', () => ({
  buildEnumOptionsLoader: () => async () => [],
  buildModuleOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  legalSubjectOptionsLoader: async () => [],
  tenantOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

describe('electronic contract page config', () => {
  it('hides the legacy edit action for template-generated contracts', () => {
    expect(electronicContractPageCrudConfig.editVisibleOn).toContain(
      '!__record.templateId',
    );
  });

  it('keeps contract fields and explicit template creation request fields', () => {
    const fieldKeys = electronicContractPageCrudConfig.fields.map(
      (field) => field.key,
    );

    expect(fieldKeys).toEqual(
      expect.arrayContaining([
        'bizOrderId',
        'category',
        'eSigningTechServiceProviderCode',
        'fileName',
        'fileUrl',
        'mimeType',
        'name',
        'sealPositionRules',
        'signingSubjectList',
      ]),
    );
    expect(fieldKeys).not.toEqual(
      expect.arrayContaining([
        'bizOrderNo',
        'bizObjId',
        'contractCategory',
        'contractPartySnapshot',
        'contractType',
        'sealPositionOverrides',
        'signMode',
        'sourceFileName',
        'sourceFileUrl',
      ]),
    );
  });

  it('uses the standard CRUD create form and submits only template creation fields', async () => {
    expect(electronicContractPageCrudConfig.allowCreate).toBe(true);
    expect(electronicContractPageCrudConfig.createPath).toBe(
      '/EContract/createFromTemplate',
    );
    const result = await electronicContractPageCrudConfig.transformSubmit?.(
      {
        contractNo: 'C-1',
        name: '测试合同',
        templateId: 'template-1',
        partyALegalSubjectId: 'subject-1',
        counterpartyKind: 'Customer',
        counterpartyId: 'customer-1',
        templateValues: { amount: '100' },
        category: '不应从页面新增提交',
        status: 'Signed',
      },
      null,
    );
    expect(result).toEqual({
      contractNo: 'C-1',
      name: '测试合同',
      templateId: 'template-1',
      partyALegalSubjectId: 'subject-1',
      counterpartyKind: 'Customer',
      counterpartyId: 'customer-1',
      templateValues: { amount: '100' },
    });
  });

  it('keeps the server-generated application number in details, outside the default table', () => {
    const field = electronicContractPageCrudConfig.fields.find(
      (item) => item.key === 'requestNo',
    );
    expect(field).toMatchObject({ form: false, label: '合同申请号' });
    expect(field?.table).toBeUndefined();
  });

  it('keeps technical data out of the default table and edit form', () => {
    const fields = electronicContractPageCrudConfig.fields;
    expect(
      fields.filter((field) => field.table).map((field) => field.key),
    ).toEqual([
      'contractNo',
      'name',
      'category',
      'templateId',
      'expireTime',
      'status',
      'createTime',
    ]);
    for (const key of [
      'fileUrl',
      'contentHash',
      'signingSubjectList',
      'sealPositionRules',
    ]) {
      expect(fields.find((field) => field.key === key)?.form).toBe(false);
    }
  });

  it('edits seal position overrides with a constrained JSON Schema form', () => {
    expect(electronicContractPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          jsonSchema: expect.objectContaining({
            properties: expect.objectContaining({
              effectivePositions: expect.objectContaining({ type: 'array' }),
            }),
          }),
          jsonSchemaMode: 'popup',
          key: 'sealPositionRules',
        }),
      ]),
    );
  });
});
