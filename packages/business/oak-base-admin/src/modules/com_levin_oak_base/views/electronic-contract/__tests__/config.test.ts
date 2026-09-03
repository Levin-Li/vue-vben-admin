import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/electronic-contract-service', () => ({
  electronicContractService: {},
}));

vi.mock('../../api-module', () => ({
  buildEnumOptionsLoader: () => async () => [],
  buildModuleOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  tenantOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

import { electronicContractPageCrudConfig } from '../config';

describe('electronic contract page config', () => {
  it('uses only fields that exist in the current electronic contract model', () => {
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
        'providerCode',
        'sealPositionOverrides',
        'signMode',
        'sourceFileName',
        'sourceFileUrl',
      ]),
    );
  });

  it('shows the server-generated contract application number only after creation', () => {
    expect(electronicContractPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          form: false,
          key: 'requestNo',
          label: '合同申请号',
          table: true,
        }),
      ]),
    );
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
