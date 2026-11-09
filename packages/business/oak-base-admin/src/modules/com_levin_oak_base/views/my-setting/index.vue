<script lang="ts" setup>
import { userPersonalSettingService } from '../../api/user-personal-setting-service';
import SettingForTenantPage from '../setting-for-tenant/index.vue';
</script>

<template>
  <SettingForTenantPage
    empty-description="暂无我的设置"
    load-error-message="我的设置加载失败"
    :service="userPersonalSettingService"
    title="我的设置"
  />
</template>
