<script lang="ts" setup>
import PartnerCrudPage from '../partner/partner-crud-page.vue';
import { supplierPartnerPageCrudConfig } from './config';
</script>

<template>
  <PartnerCrudPage :config="supplierPartnerPageCrudConfig" />
</template>
