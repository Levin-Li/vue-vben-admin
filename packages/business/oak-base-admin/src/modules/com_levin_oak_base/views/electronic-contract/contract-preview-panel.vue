<script lang="ts" setup>
import { computed } from 'vue';

import { ElectronicContractDocumentPreview } from '../../components/electronic-contract';
import type { ContractSealPosition } from '../../components/electronic-contract';

const props = defineProps<{
  contract: Record<string, any>;
}>();

const documentUrl = computed(() => props.contract.signedFileUrl || props.contract.sourceFileUrl || '');
const documentName = computed(() => props.contract.signedFileName || props.contract.sourceFileName || props.contract.title || '电子合同');
const positions = computed<ContractSealPosition[]>(() => {
  const snapshot = props.contract.contractPartySnapshot;
  const parties = Array.isArray(snapshot?.parties) ? snapshot.parties : [];
  return parties.flatMap((party: any) => {
    const position = party?.sealPosition || party?.sealPositionSnapshot;
    if (!position || !Number.isInteger(position.pageNo)) return [];
    return [{
      height: Number(position.height ?? 0.12), pageNo: Number(position.pageNo), signerLabel: String(party.roleName || party.subject?.legalSubjectName || '签署方'),
      source: position.source === 'business-override' ? 'business-override' : 'provider-default', width: Number(position.width ?? 0.18), x: Number(position.x ?? 0.65), y: Number(position.y ?? 0.72),
    }];
  });
});
</script>

<template>
  <ElectronicContractDocumentPreview :document-name="documentName" :document-url="documentUrl" :positions="positions" />
</template>
