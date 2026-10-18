<script lang="ts" setup>
import { ref } from 'vue';

import { Alert, Button, Card, Input } from 'ant-design-vue';

import { electronicContractTemplateService } from '../../api/electronic-contract-template-service';
import CrudPage from '../crud-page.vue';
import { electronicContractTemplatePageCrudConfig } from './config';

type UploadedTemplate = {
  fileHash?: string;
  fileName: string;
  fileResId: string;
  fileUrl: string;
  mimeType: string;
};
const templateNo = ref('');
const name = ref('');
const category = ref('');
const fieldSchemaText = ref('[]');
const fieldSchemaPlaceholder =
  '变量清单，如 [{"key":"customerName","title":"客户名称","required":true}]';
const tenantId = ref('');
const orgId = ref('');
const ownerId = ref('');
const uploaded = ref<null | UploadedTemplate>(null);
const busy = ref(false);
const error = ref('');
const message = ref('');

// 上传与模板创建使用同一归属，服务端仍须核验可信操作者与资源绑定。
async function uploadTemplate(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  error.value = '';
  uploaded.value = null;
  if (!/\.docx$/i.test(file.name)) {
    error.value = '请选择 .docx 模板文件';
    return;
  }
  busy.value = true;
  try {
    const response = await electronicContractTemplateService.uploadTemplateDocx(
      file,
      {
        tenantId: tenantId.value || undefined,
        orgId: orgId.value || undefined,
        ownerId: ownerId.value || undefined,
      },
    );
    const value =
      response && typeof response === 'object' && 'data' in response
        ? (response.data as UploadedTemplate)
        : (response as UploadedTemplate);
    if (!value?.fileResId || !value.fileUrl || !value.fileName)
      throw new Error('上传未返回受控文件资源');
    uploaded.value = value;
    message.value = `已上传 ${value.fileName}，可填写模板信息并保存。`;
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : '模板上传失败';
  } finally {
    busy.value = false;
  }
}

// 变量清单仅包含 key、title、required，与 Word {{key}} 占位符一致。
async function createTemplate() {
  error.value = '';
  if (
    !uploaded.value ||
    !templateNo.value.trim() ||
    !name.value.trim() ||
    !category.value.trim()
  ) {
    error.value = '请上传 Word 模板并填写编号、名称和类别';
    return;
  }
  let templateFieldSchema: { key: string; required: boolean; title: string }[];
  try {
    const parsed: unknown = JSON.parse(fieldSchemaText.value);
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (item) =>
          !item ||
          typeof item.key !== 'string' ||
          typeof item.title !== 'string' ||
          (item.required !== undefined && typeof item.required !== 'boolean'),
      )
    )
      throw new Error(
        '模板变量必须是数组，每项包含 key、title 和可选 required',
      );
    templateFieldSchema = parsed.map((item) => ({
      key: item.key,
      title: item.title,
      required: item.required === true,
    }));
  } catch (error_) {
    error.value =
      error_ instanceof Error ? error_.message : '模板变量 JSON 无效';
    return;
  }
  busy.value = true;
  try {
    await electronicContractTemplateService.create({
      ...uploaded.value,
      templateNo: templateNo.value.trim(),
      name: name.value.trim(),
      category: category.value.trim(),
      templateFieldSchema,
      status: 'Draft',
      tenantId: tenantId.value || undefined,
      orgId: orgId.value || undefined,
      ownerId: ownerId.value || undefined,
    });
    message.value = '模板草稿已保存，请在列表中核对并上线。';
    uploaded.value = null;
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : '保存模板失败';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="contract-template-page">
    <!-- 受控文件先上传并登记，生成文件始终引用返回的资源 ID。 -->
    <Card title="新建 Word 合同模板" size="small">
      <div class="contract-template-page__form">
        <Input v-model:value="templateNo" placeholder="模板编号" />
        <Input v-model:value="name" placeholder="模板名称" />
        <Input v-model:value="category" placeholder="合同类别" />
        <Input
          v-model:value="tenantId"
          placeholder="归属租户 ID（管理员代填时使用）"
        />
        <Input
          v-model:value="orgId"
          placeholder="归属组织 ID（管理员代填时使用）"
        />
        <Input
          v-model:value="ownerId"
          placeholder="归属用户 ID（管理员代填时使用）"
        />
        <label for="contract-template-docx">Word 模板（.docx）</label>
        <input
          id="contract-template-docx"
          type="file"
          accept=".docx"
          :disabled="busy"
          @change="uploadTemplate"
        />
        <Input.TextArea
          v-model:value="fieldSchemaText"
          :auto-size="{ minRows: 3, maxRows: 8 }"
          :placeholder="fieldSchemaPlaceholder"
        />
        <Button
          type="primary"
          :loading="busy"
          :disabled="!uploaded"
          @click="createTemplate"
        >
          保存模板草稿
        </Button>
        <Alert v-if="error" :message="error" type="error" show-icon />
        <Alert v-if="message" :message="message" type="success" show-icon />
      </div>
    </Card>

    <!-- 已有模板仍由标准列表查看、编辑及进行状态管理。 -->
    <CrudPage :config="electronicContractTemplatePageCrudConfig" />
  </div>
</template>

<style scoped>
.contract-template-page {
  display: grid;
  gap: 12px;
}
.contract-template-page__form {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
.contract-template-page__form label {
  display: grid;
  gap: 6px;
}
</style>
