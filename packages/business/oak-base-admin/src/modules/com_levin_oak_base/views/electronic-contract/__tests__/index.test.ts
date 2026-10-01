import { shallowMount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import ContractPage from '../index.vue';

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
}));

vi.mock('../../../api/electronic-contract-service', () => ({
  electronicContractService: {
    retrieve: mocks.retrieve,
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
  loadSimulationContract: () => Promise<void>;
  simulationStatus: string;
};

describe('电子合同模拟状态', () => {
  beforeEach(() => {
    mocks.retrieve.mockReset();
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
});
