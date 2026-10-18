<script lang="ts" setup>
import PartnerCrudPage from '../partner/partner-crud-page.vue';
import { channelPartnerPageCrudConfig } from './config';
</script>

<template>
  <PartnerCrudPage :config="channelPartnerPageCrudConfig" />
</template>
