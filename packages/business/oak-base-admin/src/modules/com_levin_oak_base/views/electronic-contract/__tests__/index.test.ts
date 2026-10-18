import { shallowMount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import ContractPage from '../index.vue';

vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  createFromTemplate: vi.fn(),
  regenerateFromTemplate: vi.fn(),
}));

vi.mock('../../../api/electronic-contract-service', () => ({
  electronicContractService: {
    retrieve: mocks.retrieve,
    createFromTemplate: mocks.createFromTemplate,
    regenerateFromTemplate: mocks.regenerateFromTemplate,
  },
}));

vi.mock('../../../api/electronic-contract-simulation-service', () => ({
  electronicContractSimulationService: {},
}));

type ContractPageState = {
  canArchive: boolean;
  canCancelSigning: boolean;
  canCopyForResign: boolean;
  canDownloadSignedFile: boolean;
  canReceiveCallback: boolean;
  canReplayCompletedCallback: boolean;
  canSubmitSigning: boolean;
  createTemplateDraft: () => Promise<void>;
  draftContract: null | { id: string; status: string };
  draftForm: {
    contractNo: string;
    counterpartyId: string;
    counterpartyKind: 'Customer';
    name: string;
    partyALegalSubjectId: string;
    providerCode: string;
    templateId: string;
    templateValues: Record<string, string>;
  };
  loadSimulationContract: () => Promise<void>;
  regenerateTemplateDraft: () => Promise<void>;
  simulationStatus: string;
  templates: { id: string; name: string; templateFieldSchema: unknown }[];
};

describe('电子合同模拟状态', () => {
  beforeEach(() => {
    mocks.retrieve.mockReset();
    mocks.createFromTemplate.mockReset();
    mocks.regenerateFromTemplate.mockReset();
  });

  it('未知非空状态不提供任何流程动作', async () => {
    mocks.retrieve.mockResolvedValueOnce({
      data: { status: 'UnexpectedState' },
    });
    const wrapper = shallowMount(ContractPage);
    const page = wrapper.vm as unknown as ContractPageState;

    await page.loadSimulationContract();

    expect(page.simulationStatus).toBe('UnexpectedState');
    expect(page.canSubmitSigning).toBe(false);
    expect(page.canArchive).toBe(false);
    expect(page.canCancelSigning).toBe(false);
    expect(page.canCopyForResign).toBe(false);
    expect(page.canDownloadSignedFile).toBe(false);
    expect(page.canReceiveCallback).toBe(false);
    expect(page.canReplayCompletedCallback).toBe(false);
  });

  it('已知草稿状态仍只开放提交签署', async () => {
    mocks.retrieve.mockResolvedValueOnce({ data: { status: 'Draft' } });
    const wrapper = shallowMount(ContractPage);
    const page = wrapper.vm as unknown as ContractPageState;

    await page.loadSimulationContract();

    expect(page.simulationStatus).toBe('Draft');
    expect(page.canSubmitSigning).toBe(true);
    expect(page.canReceiveCallback).toBe(false);
  });

  it('模板草稿变更通过重新生成接口提交合同 ID 和变量', async () => {
    mocks.createFromTemplate.mockResolvedValueOnce({
      id: 'contract-1',
      status: 'Draft',
    });
    mocks.regenerateFromTemplate.mockResolvedValueOnce({
      id: 'contract-1',
      status: 'Draft',
    });
    const page = shallowMount(ContractPage).vm as unknown as ContractPageState;
    page.templates = [
      {
        id: 'template-1',
        name: '合同模板',
        templateFieldSchema: [{ key: 'amount', title: '金额', required: true }],
      },
    ];
    Object.assign(page.draftForm, {
      templateId: 'template-1',
      contractNo: 'C-1',
      name: '合同',
      partyALegalSubjectId: 'subject-1',
      counterpartyKind: 'Customer',
      counterpartyId: 'customer-1',
      templateValues: { amount: '100' },
    });
    await page.createTemplateDraft();
    expect(mocks.createFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'template-1',
        templateValues: { amount: '100' },
      }),
    );
    page.draftForm.templateValues.amount = '200';
    await page.regenerateTemplateDraft();
    expect(mocks.regenerateFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 'contract-1',
        templateValues: { amount: '200' },
      }),
    );
  });
});
