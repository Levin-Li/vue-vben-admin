<script setup lang="ts">
import type {
  CreateInvitationLinkRequest,
  InvitationTarget,
  InvitationTargetOrganization,
  InvitationTargetTenant,
} from '../../api/invitation-link-service';

import { computed, nextTick, ref } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
import { Button, Form, Input, message, Modal, Select } from 'ant-design-vue';

import { invitationLinkService } from '../../api/invitation-link-service';
import {
  createInvitationLinkCrudConfig,
  createMethodByTarget,
  invitationCreateActions,
  normalizeInvitationListQuery,
  projectInvitationDetail,
} from './config';
import InvitationChannelPicker from './invitation-channel-picker.vue';

const { hasPermission } = useRbacAccess();
const userStore = useUserStore();
const platformUser = computed(() => {
  const user = userStore.userInfo as null | Record<string, any>;
  // 与公共 CRUD 的平台身份判断一致；服务端仍逐次验证真实租户授权。
  const roles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.roleList) ? user.roleList : []),
  ];
  return (
    isPlatformUser(user) ||
    user?.platformAdmin === true ||
    user?.isPlatformAdmin === true ||
    roles.some((role) =>
      String(typeof role === 'string' ? role : role?.code || '').startsWith(
        'R_PLATFORM_',
      ),
    )
  );
});
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(invitationLinkService, method));
const canInviteAdministrator = (target: InvitationTarget) =>
  allowed(target === 'Internal' ? 'canInviteOrgAdmin' : 'canInviteChildAdmin');
const activeTarget = ref<InvitationTarget>('Internal');
const targetOrganizations = ref<InvitationTargetOrganization[]>([]);
const defaultOrganizations = ref<InvitationTargetOrganization[]>([]);
const targetTenants = ref<InvitationTargetTenant[]>([]);
const organizationsLoading = ref(false);
const organizationCategoryOptions = ref<
  Array<{ label: string; value: string }>
>([]);
const accountTypeOptions = ref<Array<{ label: string; value: string }>>([]);
const dictionaryLoading = ref(false);
let organizationRequestVersion = 0;
async function loadTenantOptions(keyword?: string) {
  // 候选只来自邀请服务返回的可访问租户，搜索在当前选项中完成。
  const tenants = await invitationLinkService.targetTenants();
  const filter = (keyword || '').trim().toLowerCase();
  return tenants
    .filter((tenant) => !filter || tenant.name.toLowerCase().includes(filter))
    .map((tenant) => ({ label: tenant.name, value: tenant.id }));
}
const createdUrl = ref('');
const revokeId = ref('');
const revokeReason = ref('');
const revoking = ref(false);
const crudPage = ref<{
  isFormOpen: () => boolean;
  openCreate: () => Promise<void>;
  reload: () => Promise<void>;
}>();

let openingCreate = false;
async function openInvitation(target: InvitationTarget) {
  if (!allowed(createMethodByTarget[target]))
    throw new Error('当前账号无权创建此类邀请链接');
  if (openingCreate || crudPage.value?.isFormOpen()) return;
  openingCreate = true;
  try {
    // 平台用户先在标准表单选择租户；租户用户仍按服务端会话租户获取组织。
    organizationRequestVersion++;
    targetOrganizations.value = [];
    organizationCategoryOptions.value = [];
    accountTypeOptions.value = [];
    if (platformUser.value) {
      targetTenants.value = await invitationLinkService.targetTenants();
    } else {
      targetOrganizations.value =
        await invitationLinkService.targetOrganizations();
      if (targetOrganizations.value.length === 0)
        throw new Error('当前没有可邀请的组织');
      if (['ChannelPartner', 'Customer', 'SupplierPartner'].includes(target)) {
        await loadInvitationDictionaries(undefined, organizationRequestVersion);
      }
    }
    // 表单配置只在打开前确定默认值；异步组织选项变化不得重置 CRUD 权限快照。
    defaultOrganizations.value = [...targetOrganizations.value];
    activeTarget.value = target;
    await nextTick();
    await crudPage.value?.openCreate();
  } finally {
    openingCreate = false;
  }
}

async function loadInvitationDictionaries(
  tenantId: string | undefined,
  version: number,
) {
  dictionaryLoading.value = true;
  try {
    const [organization, account] = await Promise.all([
      invitationLinkService.targetDictionaryOptions(
        'organizationCategory',
        tenantId,
      ),
      invitationLinkService.targetDictionaryOptions('accountType', tenantId),
    ]);
    if (version !== organizationRequestVersion) return;
    organizationCategoryOptions.value = organization;
    accountTypeOptions.value = account;
  } catch (error) {
    if (version === organizationRequestVersion) {
      message.error(
        error instanceof Error ? error.message : '获取字典选项失败',
      );
    }
  } finally {
    if (version === organizationRequestVersion) dictionaryLoading.value = false;
  }
}

async function changeInvitationTenant(
  formState: Record<string, any>,
  value?: string,
) {
  // 切换租户立即清除所有依赖数据；旧请求不能覆盖新租户结果。
  formState.tenantId = value;
  formState.targetOrgId = undefined;
  formState.channelPartnerId = undefined;
  formState.organizationCategory = undefined;
  formState.accountType = undefined;
  targetOrganizations.value = [];
  organizationCategoryOptions.value = [];
  accountTypeOptions.value = [];
  const version = ++organizationRequestVersion;
  organizationsLoading.value = Boolean(value);
  dictionaryLoading.value = false;
  if (!value) return;
  if (
    ['ChannelPartner', 'Customer', 'SupplierPartner'].includes(
      activeTarget.value,
    )
  ) {
    void loadInvitationDictionaries(value, version);
  }
  try {
    const organizations =
      await invitationLinkService.targetOrganizations(value);
    if (version === organizationRequestVersion)
      targetOrganizations.value = organizations;
  } catch (error) {
    if (version === organizationRequestVersion) {
      message.error(
        error instanceof Error ? error.message : '获取可邀请组织失败',
      );
    }
  } finally {
    if (version === organizationRequestVersion)
      organizationsLoading.value = false;
  }
}

function changeInvitationOrganization(
  formState: Record<string, any>,
  value?: string,
) {
  // 渠道关系必须与目标组织一致，切换目标组织后不能沿用旧选择。
  formState.targetOrgId = value;
  formState.channelPartnerId = undefined;
}

function createPayload(
  values: Record<string, any>,
  target: InvitationTarget,
): CreateInvitationLinkRequest {
  const external = ['ChannelPartner', 'Customer', 'SupplierPartner'].includes(
    target,
  );
  const organizationMode = external
    ? 'CreateChildOrg'
    : values.organizationMode;
  // 会员邀请固定为普通身份；内部与外部邀请均按权限选择账号身份。
  const invitedUserType = target === 'Member' ? 'Employee' : values.userType;
  if (
    invitedUserType === 'Administrator' &&
    (!canInviteAdministrator(target) ||
      (target !== 'Internal' && organizationMode !== 'CreateChildOrg'))
  )
    throw new Error('当前账号无权邀请管理员');
  let childOrgType: string | undefined;
  if (external) childOrgType = target;
  else if (organizationMode === 'CreateChildOrg')
    childOrgType = values.childOrgType;
  return {
    ...(platformUser.value ? { tenantId: values.tenantId } : {}),
    ...(external && values.organizationCategory
      ? { organizationCategory: values.organizationCategory }
      : {}),
    ...(external && values.accountType
      ? { accountType: values.accountType }
      : {}),
    targetOrgId: values.targetOrgId,
    registrationChannel: values.registrationChannel,
    expiresAt: values.expiresAt || null,
    usageMode: values.usageMode,
    ...(values.usageMode === 'Limited'
      ? { maxRegistrations: values.maxRegistrations }
      : {}),
    userType: invitedUserType,
    organizationMode,
    ...(childOrgType ? { childOrgType } : {}),
    ...(target === 'Customer'
      ? {
          customerType: values.customerType,
          ...(values.customerType === 'ChannelCustomer'
            ? { channelPartnerId: values.channelPartnerId }
            : {}),
        }
      : {}),
    ...(target === 'SupplierPartner'
      ? { supplierPartnerType: values.supplierPartnerType }
      : {}),
    ...(target === 'ChannelPartner'
      ? { channelPartnerType: values.channelPartnerType }
      : {}),
  };
}

const pageConfig = computed(() => {
  const target = activeTarget.value;
  const method = createMethodByTarget[target];
  const config = createInvitationLinkCrudConfig({
    target,
    targetOrganizations: defaultOrganizations.value,
    isPlatformUser: platformUser.value,
    canSelectTenant: Object.values(createMethodByTarget).some((name) =>
      allowed(name),
    ),
    loadTenantOptions,
    canInviteChildAdmin: allowed('canInviteChildAdmin'),
    canCreate: allowed(method),
    createActions: invitationCreateActions(openInvitation),
    apiService: {
      list: async (params = {}) => {
        const result = await invitationLinkService.list(
          normalizeInvitationListQuery(params),
        );
        return { items: result.items, totals: result.total };
      },
      retrieve: async ({ id }: { id: string }) => {
        // 保留业务摘要并剔除不适用或内部字段，服务端身份值及复制请求保持不变。
        const result = await invitationLinkService.retrieve(id);
        return projectInvitationDetail(result, platformUser.value);
      },
      create: async (values: CreateInvitationLinkRequest) => {
        if (!allowed(method)) throw new Error('当前账号无权创建此类邀请链接');
        const result = await invitationLinkService[method](values);
        createdUrl.value = result.url;
        return result;
      },
    },
  });
  config.transformSubmit = (values: Record<string, any>) =>
    createPayload(values, target);
  return config;
});

async function copy(id: string) {
  if (!allowed('copyLink')) return;
  try {
    const result = await invitationLinkService.copyLink(id);
    await navigator.clipboard.writeText(result.url);
    message.success('链接已复制');
  } catch (error_) {
    message.error(error_ instanceof Error ? error_.message : '复制失败');
  }
}

async function revoke() {
  if (!revokeId.value || !revokeReason.value.trim() || !allowed('revoke'))
    return;
  revoking.value = true;
  try {
    await invitationLinkService.revoke(
      revokeId.value,
      revokeReason.value.trim(),
    );
    revokeId.value = '';
    revokeReason.value = '';
    await crudPage.value?.reload();
    message.success('链接已作废');
  } catch (error_) {
    message.error(error_ instanceof Error ? error_.message : '作废失败');
  } finally {
    revoking.value = false;
  }
}

async function copyCreatedUrl() {
  if (!createdUrl.value) return;
  try {
    await navigator.clipboard.writeText(createdUrl.value);
    message.success('链接已复制');
  } catch {
    message.error('复制失败，请手动复制链接');
  }
}
</script>

<template>
  <CrudPage ref="crudPage" :config="pageConfig">
    <template #form-field-tenantId="{ formState, disabled }">
      <Select
        :disabled="disabled"
        :options="
          targetTenants.map((tenant) => ({
            label: tenant.name,
            value: tenant.id,
          }))
        "
        :value="formState.tenantId"
        allow-clear
        class="w-full"
        placeholder="请选择归属租户"
        show-search
        option-filter-prop="label"
        @update:value="
          (value) => !disabled && changeInvitationTenant(formState, value)
        "
      />
    </template>
    <template #form-field-targetOrgId="{ formState, disabled }">
      <Select
        :disabled="
          disabled ||
          organizationsLoading ||
          (platformUser && !formState.tenantId)
        "
        :loading="organizationsLoading"
        :options="
          targetOrganizations.map((org) => ({ label: org.name, value: org.id }))
        "
        :value="formState.targetOrgId"
        class="w-full"
        placeholder="请选择邀请组织"
        show-search
        option-filter-prop="label"
        @update:value="
          (value) => !disabled && changeInvitationOrganization(formState, value)
        "
      />
    </template>
    <template #form-field-userType="{ formState, disabled }">
      <Select
        v-model:value="formState.userType"
        :disabled="disabled"
        :options="[
          {
            label: activeTarget === 'Internal' ? '普通员工' : '普通用户',
            value: 'Employee',
          },
          ...(canInviteAdministrator(activeTarget)
            ? [{ label: '管理员', value: 'Administrator' }]
            : []),
        ]"
        class="w-full"
        placeholder="请选择账号身份"
      />
    </template>
    <template #form-field-organizationCategory="{ formState, disabled }">
      <Select
        v-model:value="formState.organizationCategory"
        :disabled="
          disabled || dictionaryLoading || (platformUser && !formState.tenantId)
        "
        :loading="dictionaryLoading"
        :options="organizationCategoryOptions"
        allow-clear
        class="w-full"
        placeholder="请选择组织类别"
      />
    </template>
    <template #form-field-accountType="{ formState, disabled }">
      <Select
        v-model:value="formState.accountType"
        :disabled="
          disabled || dictionaryLoading || (platformUser && !formState.tenantId)
        "
        :loading="dictionaryLoading"
        :options="accountTypeOptions"
        allow-clear
        class="w-full"
        placeholder="请选择用户类型"
      />
    </template>
    <template #form-field-channelPartnerId="{ formState, disabled }">
      <InvitationChannelPicker
        v-model="formState.channelPartnerId"
        :disabled="
          disabled ||
          !formState.targetOrgId ||
          (platformUser && !formState.tenantId)
        "
        :tenant-id="platformUser ? formState.tenantId : undefined"
        :target-org-id="formState.targetOrgId"
      />
    </template>
    <template #row-actions="{ record }">
      <Button
        v-if="allowed('copyLink') && record.status === 'Active'"
        type="link"
        @click="copy(record.id)"
      >
        复制链接
      </Button>
      <Button
        v-if="allowed('revoke') && record.status === 'Active'"
        danger
        type="link"
        @click="revokeId = record.id"
      >
        作废
      </Button>
    </template>
  </CrudPage>
  <Modal
    :open="Boolean(createdUrl)"
    title="邀请链接已创建"
    :footer="null"
    @cancel="createdUrl = ''"
  >
    <div class="flex gap-2">
      <Input :value="createdUrl" readonly aria-label="新创建的邀请链接" />
      <Button type="primary" @click="copyCreatedUrl">复制链接</Button>
    </div>
  </Modal>
  <Modal
    :open="Boolean(revokeId)"
    title="作废邀请链接"
    :confirm-loading="revoking"
    @ok="revoke"
    @cancel="revokeId = ''"
  >
    <Form
      id="invitation-link-revoke"
      name="invitationLinkRevoke"
      data-form-id="invitation-link-revoke"
      data-form-name="作废邀请链接"
      layout="vertical"
    >
      <Form.Item label="作废原因" required>
        <Input v-model:value="revokeReason" :maxlength="200" />
      </Form.Item>
    </Form>
  </Modal>
</template>
