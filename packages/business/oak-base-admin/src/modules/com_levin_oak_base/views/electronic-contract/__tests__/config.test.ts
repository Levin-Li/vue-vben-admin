import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/electronic-contract-service', () => ({
  electronicContractService: {},
}));

vi.mock('../../api-module', () => ({
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  buildModuleOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  tenantOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

import { electronicContractPageCrudConfig } from '../config';

describe('electronic contract page config', () => {
  it('uses system dictionaries for business type and contract classification', () => {
    expect(electronicContractPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'bizType', type: 'select' }),
        expect.objectContaining({ key: 'contractCategory', type: 'select' }),
        expect.objectContaining({ key: 'contractType', type: 'select' }),
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
          key: 'sealPositionOverrides',
        }),
      ]),
    );
  });
});
