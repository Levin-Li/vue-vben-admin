<script setup lang="ts">
import type {
  AiModelConfigurationInput,
  AiModelConfigurationView,
  AiModelScope,
} from '../api/ai-model-configuration-service';

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { aiModelConfigurationService } from '../api/ai-model-configuration-service';

const emit = defineEmits<{ close: []; saved: [] }>();
const labels: Record<AiModelScope, string> = {
  personal: '个人',
  organization: '当前组织',
  tenant: '当前租户',
  platform: '平台默认',
};
const providers = ref<string[]>([]);
const availableScopes = ref<AiModelScope[]>([]);
const scope = ref<AiModelScope>('personal');
const provider = ref('openai');
const records = ref<AiModelConfigurationView[]>([]);
const name = ref('');
const baseUrl = ref('');
const apiKey = ref('');
const keyConfigured = ref(false);
const defaultModel = ref('default');
const aliases = ref<Array<{ alias: string; id: string }>>([
  { alias: 'default', id: '' },
]);
const timeoutSeconds = ref(60);
const enabled = ref(true);
const version = ref<number>();
const busy = ref(false);
const message = ref('');
let requestController = new AbortController();
let sequence = 0;
function clearSecret() {
  apiKey.value = '';
}
function applyProvider() {
  clearSecret();
  const found = records.value.find(
    (item) => item.providerCode === provider.value,
  );
  name.value = found?.name ?? '';
  baseUrl.value = found?.baseUrl ?? '';
  keyConfigured.value = found?.keyConfigured ?? false;
  defaultModel.value = found?.defaultModel ?? 'default';
  const entries = Object.entries(found?.models ?? {});
  aliases.value =
    entries.length > 0
      ? entries.map(([alias, id]) => ({ alias, id }))
      : [{ alias: 'default', id: '' }];
  timeoutSeconds.value = found?.timeoutSeconds ?? 60;
  enabled.value = found?.enabled ?? true;
  version.value = found?.version;
}

async function loadScope() {
  requestController.abort();
  requestController = new AbortController();
  const current = ++sequence;
  clearSecret();
  busy.value = true;
  message.value = '';
  try {
    const result = await aiModelConfigurationService.list(
      scope.value,
      requestController.signal,
    );
    if (current !== sequence) return;
    if (!Array.isArray(result)) throw new Error('invalid response');
    records.value = result;
    applyProvider();
  } catch {
    if (current === sequence) {
      records.value = [];
      applyProvider();
      message.value = '读取配置失败，请检查当前范围和权限。';
    }
  } finally {
    if (current === sequence) busy.value = false;
  }
}

onMounted(async () => {
  const initialSequence = sequence;
  busy.value = true;
  try {
    const [result, providerResult] = await Promise.all([
      aiModelConfigurationService.scopes(requestController.signal),
      aiModelConfigurationService.providers(requestController.signal),
    ]);
    if (initialSequence !== sequence) return;
    providers.value = Array.isArray(providerResult)
      ? [
          ...new Set(
            providerResult.filter(
              (value) =>
                typeof value === 'string' && /^[a-z][\w-]{0,31}$/.test(value),
            ),
          ),
        ]
      : [];
    if (providers.value.length === 0) {
      message.value = '当前没有可用的网页供应商。';
      return;
    }
    if (!providers.value.includes(provider.value))
      provider.value = providers.value[0] ?? '';
    availableScopes.value = Array.isArray(result)
      ? result.filter((value) => Object.hasOwn(labels, value))
      : [];
    if (availableScopes.value.length === 0) {
      message.value = '当前账号没有可维护的配置范围。';
      return;
    }
    if (availableScopes.value.includes(scope.value)) {
      await loadScope();
    } else {
      scope.value = availableScopes.value[0] ?? 'personal';
    }
  } catch {
    if (initialSequence === sequence)
      message.value = '读取配置范围失败，请检查登录状态和加密连接。';
  } finally {
    if (initialSequence === sequence) busy.value = false;
  }
});

watch(scope, () => {
  if (availableScopes.value.length > 0) void loadScope();
});
watch(provider, applyProvider);
onBeforeUnmount(() => {
  sequence++;
  requestController.abort();
  clearSecret();
});

async function save() {
  if (busy.value) return;
  const current = sequence;
  message.value = '';
  try {
    const models: Record<string, string> = Object.create(null);
    for (const row of aliases.value) {
      const alias = row.alias.trim();
      const id = row.id.trim();
      if (
        !alias ||
        !id ||
        alias.length > 256 ||
        id.length > 256 ||
        Object.hasOwn(models, alias) ||
        ['__proto__', 'constructor', 'prototype'].includes(alias)
      )
        throw new Error('invalid models');
      models[alias] = id;
    }
    if (
      !Object.hasOwn(models, defaultModel.value) ||
      !baseUrl.value.trim() ||
      (!keyConfigured.value && !apiKey.value.trim())
    )
      throw new Error('missing configuration');
    const payload: AiModelConfigurationInput = {
      scope: scope.value,
      providerCode: provider.value,
      name: name.value.trim(),
      baseUrl: baseUrl.value.trim(),
      ...(apiKey.value ? { apiKey: apiKey.value } : {}),
      defaultModel: defaultModel.value,
      models,
      timeoutSeconds: Number(timeoutSeconds.value),
      enabled: enabled.value,
      ...(version.value === undefined
        ? {}
        : { expectedVersion: version.value }),
    };
    busy.value = true;
    await aiModelConfigurationService.save(payload, requestController.signal);
    if (current !== sequence) return;
    clearSecret();
    emit('saved');
    await loadScope();
    message.value = '配置已保存。';
  } catch {
    clearSecret();
    if (current === sequence)
      message.value =
        '保存失败，请检查模型、地址、权限和服务端密钥保护配置后重试。';
  } finally {
    if (current === sequence) busy.value = false;
  }
}
</script>

<template>
  <div class="model-settings-backdrop" role="presentation">
    <section
      class="model-settings"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-model-settings-title"
    >
      <header>
        <h2 id="ai-model-settings-title">AI 模型配置</h2>
        <button type="button" @click="emit('close')">关闭</button>
      </header>
      <p>
        浏览器直接请求供应商。使用共享配置时，获准用户可在浏览器中取得对应密钥，请设置供应商额度。
      </p>
      <form @submit.prevent="save">
        <div class="fields">
          <label>
            <span>配置范围</span>
            <select v-model="scope" :disabled="busy">
              <option v-for="item in availableScopes" :key="item" :value="item">
                {{ labels[item] }}
              </option>
            </select>
          </label>
          <label>
            <span>模型供应商</span>
            <select v-model="provider" :disabled="busy">
              <option v-for="item in providers" :key="item" :value="item">
                {{ item }}
              </option>
            </select>
          </label>
          <label>
            <span>配置名称</span>
            <input v-model="name" maxlength="128" :disabled="busy" />
          </label>
          <label>
            <span>HTTPS 接口地址</span>
            <input
              v-model="baseUrl"
              type="url"
              maxlength="2048"
              required
              :disabled="busy"
              placeholder="https://..."
            />
          </label>
          <label>
            <span>网页专用 API Key</span>
            <input
              v-model="apiKey"
              type="password"
              autocomplete="new-password"
              :disabled="busy"
              :placeholder="keyConfigured ? '已设置；留空保留' : '首次保存必填'"
            />
          </label>
          <label>
            <span>超时时间（秒）</span>
            <input
              v-model.number="timeoutSeconds"
              type="number"
              min="1"
              max="120"
              required
              :disabled="busy"
            />
          </label>
        </div>
        <fieldset>
          <legend>模型映射</legend>
          <div v-for="(row, index) in aliases" :key="index" class="model-row">
            <input
              v-model="row.alias"
              aria-label="模型别名"
              placeholder="别名"
              maxlength="256"
              :disabled="busy"
            />
            <input
              v-model="row.id"
              aria-label="供应商模型 ID"
              placeholder="供应商模型 ID"
              maxlength="256"
              :disabled="busy"
            />
            <button
              type="button"
              :disabled="busy || aliases.length === 1"
              @click="aliases.splice(index, 1)"
            >
              删除
            </button>
          </div>
          <button
            type="button"
            :disabled="busy || aliases.length >= 100"
            @click="aliases.push({ alias: '', id: '' })"
          >
            添加模型
          </button>
        </fieldset>
        <div class="fields">
          <label>
            <span>默认模型别名</span>
            <select v-model="defaultModel" :disabled="busy">
              <option
                v-for="row in aliases"
                :key="row.alias"
                :value="row.alias"
              >
                {{ row.alias }}
              </option>
            </select>
          </label>
          <label class="switch">
            <input v-model="enabled" type="checkbox" :disabled="busy" />
            <span>启用此范围的配置</span>
          </label>
        </div>
        <p v-if="message" role="status">{{ message }}</p>
        <button type="submit" :disabled="busy || availableScopes.length === 0">
          保存配置
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.model-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 16px;
  background: hsl(var(--overlay));
}
.model-settings {
  box-sizing: border-box;
  width: min(760px, 100%);
  max-height: 90vh;
  overflow: auto;
  padding: 20px;
  border-radius: 12px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
.model-settings * {
  box-sizing: border-box;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
h2 {
  margin: 0;
  font-size: 18px;
}
p {
  margin: 10px 0;
  line-height: 1.5;
}
form,
label {
  display: grid;
  gap: 8px;
}
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
input,
select,
textarea {
  width: 100%;
  min-width: 0;
  padding: 7px;
  border: 1px solid hsl(var(--border));
  border-radius: 5px;
  background: transparent;
  color: inherit;
}
fieldset {
  margin: 6px 0;
  padding: 10px;
  border: 1px solid hsl(var(--border));
}
.model-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 8px;
  margin-bottom: 8px;
}
.switch {
  display: flex;
  align-items: center;
}
.switch input {
  width: auto;
}
button {
  padding: 6px 10px;
  color: hsl(var(--secondary-foreground));
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 5px;
  cursor: pointer;
}
button[type='submit'] {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
}
@media (max-width: 600px) {
  .fields {
    grid-template-columns: 1fr;
  }
  .model-row {
    grid-template-columns: 1fr;
  }
}
</style>
