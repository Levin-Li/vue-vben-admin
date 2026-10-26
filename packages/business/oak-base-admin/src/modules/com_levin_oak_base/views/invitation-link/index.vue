<script setup lang="ts">
import type {
  CreateInvitationLinkRequest,
  InvitationTarget,
} from '../../api/invitation-link-service';

import { computed, nextTick, ref } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { Button, Form, Input, message, Modal } from 'ant-design-vue';

import { invitationLinkService } from '../../api/invitation-link-service';
import ChannelPartnerPicker from '../customer/channel-partner-picker.vue';
import {
  createInvitationLinkCrudConfig,
  createMethodByTarget,
  invitationCreateActions,
  normalizeInvitationListQuery,
} from './config';

const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(invitationLinkService, method));
const activeTarget = ref<InvitationTarget>('Internal');
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
    activeTarget.value = target;
    await nextTick();
    await crudPage.value?.openCreate();
  } finally {
    openingCreate = false;
  }
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
  if (
    values.userType === 'Administrator' &&
    (!allowed('canInviteChildAdmin') || organizationMode !== 'CreateChildOrg')
  )
    throw new Error('当前账号无权邀请子组织管理员');
  let childOrgType: string | undefined;
  if (external) childOrgType = target;
  else if (organizationMode === 'CreateChildOrg')
    childOrgType = values.childOrgType;
  return {
    registrationChannel: values.registrationChannel,
    expiresAt: values.expiresAt,
    usageMode: values.usageMode,
    ...(values.usageMode === 'Limited'
      ? { maxRegistrations: values.maxRegistrations }
      : {}),
    userType: target === 'Member' ? 'Employee' : values.userType,
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
      retrieve: ({ id }: { id: string }) => invitationLinkService.retrieve(id),
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
    <template #form-field-channelPartnerId="{ formState, disabled }">
      <ChannelPartnerPicker
        v-model="formState.channelPartnerId"
        :disabled="disabled"
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
