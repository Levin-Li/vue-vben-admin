<script lang="ts" setup>
import type {
  AdministrativeAreaLevel,
  BehaviorCaptchaMode,
} from '@levin/admin-framework';

import { computed, ref } from 'vue';

import {
  AdministrativeAreaCascader,
  BehaviorCaptcha,
  normalizeAdministrativeAreaCode,
  normalizeBehaviorCaptchaChallenge,
  resolveAdministrativeAreaCodeLevel,
  resolveAdministrativeAreaSelectableLevels,
  UserOrgSelector,
} from '@levin/admin-framework';
import { fileStorageService } from '@levin/admin-framework/framework-commons/app/api/file-storage-service';
import { Button, Card, Input, Radio, Switch, Tag, Upload } from 'ant-design-vue';

type SelectionMode = 'auto' | AdministrativeAreaLevel;

const selectionMode = ref<SelectionMode>('auto');
const selectedCode = ref('');
const normalizeToSixDigits = ref(true);
const savedCode = ref('');
const captchaMode = ref<BehaviorCaptchaMode>('CLICK');
const captchaResult = ref('未完成');
const fileList = ref<any[]>([]);
const orgSelection = ref<string[]>([]);

const CAPTCHA_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="180"><rect width="100%" height="100%" fill="#e0f2fe"/><path d="M0 130 Q90 40 180 120 T360 75" fill="none" stroke="#38bdf8" stroke-width="10"/><text x="180" y="45" text-anchor="middle" font-size="20" fill="#0f172a">组件测试验证码</text></svg>',
)}`;

const selectableLevels = computed(() =>
  selectionMode.value === 'auto' ? undefined : [selectionMode.value],
);

const effectiveLevels = computed(() =>
  resolveAdministrativeAreaSelectableLevels(
    selectableLevels.value,
    selectedCode.value,
  ),
);

const codeLevel = computed(() => {
  try {
    return resolveAdministrativeAreaCodeLevel(selectedCode.value) || '未选择';
  } catch {
    return '无效编码';
  }
});

const normalizedPreview = computed(() => {
  try {
    return selectedCode.value
      ? normalizeAdministrativeAreaCode(selectedCode.value)
      : '—';
  } catch {
    return '无效编码';
  }
});

const captchaChallenge = computed(() => {
  const mode = captchaMode.value;
  return normalizeBehaviorCaptchaChallenge({
    challengeId: `component-demo-${mode}`,
    mode,
    prompt:
      mode === 'OBSTACLE_AVOIDANCE'
        ? '拖动起点到终点，并避开障碍物。'
        : '这是仅用于组件交互测试的模拟挑战。',
    payload:
      mode === 'OBSTACLE_AVOIDANCE'
        ? {
            ballRadius: 10,
            height: 180,
            image: CAPTCHA_IMAGE,
            kind: 'path',
            start: { x: 30, y: 145 },
            targetIcon: '★',
            width: 360,
          }
        : {
            height: 180,
            image: CAPTCHA_IMAGE,
            requiredClicks: mode === 'IDIOM_CLICK' ? 1 : 2,
            thumb: CAPTCHA_IMAGE,
            thumbHeight: 48,
            thumbWidth: 48,
            thumbX: 120,
            thumbY: 80,
            width: 360,
          },
  });
});

function useSample(code: string, mode: SelectionMode = 'auto') {
  selectedCode.value = code;
  selectionMode.value = mode;
  savedCode.value = '';
}

function savePreview() {
  try {
    savedCode.value = selectedCode.value
      ? normalizeToSixDigits.value
        ? normalizeAdministrativeAreaCode(selectedCode.value)
        : selectedCode.value
      : '';
  } catch {
    savedCode.value = '无效编码，不能保存';
  }
}

function onCaptchaComplete(result: { mode?: string }) {
  captchaResult.value = `${result.mode || captchaMode.value} 已完成（仅展示结果）`;
}

async function uploadTestFile(option: any) {
  try {
    const file = option.file as File;
    const url = await fileStorageService.uploadFile(file);
    fileList.value = [
      ...fileList.value,
      {
        name: file.name,
        status: 'done',
        uid: `${Date.now()}-${file.name}`,
        url,
      },
    ];
    option.onSuccess?.({ url }, file);
  } catch (error) {
    option.onError?.(error);
  }
}

function removeTestFile(file: { uid?: string }) {
  fileList.value = fileList.value.filter((item) => item.uid !== file.uid);
}
</script>

<template>
  <Card title="区域选择器测试台" size="small">
    <p class="text-muted-foreground mb-4">
      此区域不调用业务保存接口，用于验证层级限制、未配置兜底规则和保存时的六码补全。
    </p>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="space-y-4">
        <div>
          <div class="mb-2 font-medium">测试场景</div>
          <div class="flex flex-wrap gap-2">
            <Button @click="useSample('33')">2 位省：33</Button>
            <Button @click="useSample('3301')">4 位市：3301</Button>
            <Button @click="useSample('330106')">6 位区县：330106</Button>
            <Button @click="useSample('110000', 'city')">
              直辖市城市：110000
            </Button>
            <Button @click="useSample('')">空值默认区县</Button>
          </div>
        </div>

        <div>
          <div class="mb-2 font-medium">页面静态层级配置</div>
          <Radio.Group v-model:value="selectionMode" button-style="solid">
            <Radio.Button value="auto">未指定</Radio.Button>
            <Radio.Button value="province">省</Radio.Button>
            <Radio.Button value="city">市</Radio.Button>
            <Radio.Button value="district">区县</Radio.Button>
          </Radio.Group>
        </div>

        <div>
          <div class="mb-2 font-medium">当前编码</div>
          <Input v-model:value="selectedCode" placeholder="例如：33、3301、330106" />
        </div>

        <div>
          <div class="mb-2 font-medium">区域选择器</div>
          <AdministrativeAreaCascader
            v-model="selectedCode"
            :normalize-to-six-digits="normalizeToSixDigits"
            :selectable-levels="selectableLevels"
          />
        </div>

        <div class="flex items-center gap-3">
          <Switch v-model:checked="normalizeToSixDigits" />
          <span>保存时补全六码</span>
          <Button type="primary" @click="savePreview">模拟保存</Button>
        </div>
      </div>

      <div class="bg-muted/30 space-y-4 rounded-md p-4">
        <div>
          <div class="text-muted-foreground text-sm">原始编码</div>
          <Tag class="mt-1">{{ selectedCode || '—' }}</Tag>
        </div>
        <div>
          <div class="text-muted-foreground text-sm">编码判定层级</div>
          <Tag class="mt-1" color="blue">{{ codeLevel }}</Tag>
        </div>
        <div>
          <div class="text-muted-foreground text-sm">当前允许选择的层级</div>
          <Tag v-for="level in effectiveLevels" :key="level" class="mt-1" color="green">
            {{ level }}
          </Tag>
        </div>
        <div>
          <div class="text-muted-foreground text-sm">六码补全预览</div>
          <Tag class="mt-1" color="purple">{{ normalizedPreview }}</Tag>
        </div>
        <div>
          <div class="text-muted-foreground text-sm">模拟保存值</div>
          <Tag class="mt-1" color="orange">{{ savedCode || '未保存' }}</Tag>
        </div>
      </div>
    </div>
  </Card>

  <div class="grid gap-4 xl:grid-cols-2">
    <Card title="文件上传测试" size="small">
      <p class="text-muted-foreground mb-3">
        通过统一文件存储接口上传；文件仅写入文件存储，不创建业务记录。
      </p>
      <Upload
        :custom-request="uploadTestFile"
        :file-list="fileList"
        :multiple="true"
        @remove="removeTestFile"
      >
        <Button>选择并上传文件</Button>
      </Upload>
    </Card>

    <Card title="组织选择组件测试" size="small">
      <p class="text-muted-foreground mb-3">
        使用当前账号可访问的组织数据；不修改当前全局组织上下文。
      </p>
      <UserOrgSelector
        v-model="orgSelection"
        :multiple="true"
        mode="org"
        placeholder="请选择组织"
      />
      <div class="text-muted-foreground mt-3 text-sm">
        当前选择：{{ orgSelection.length ? orgSelection.join(', ') : '未选择' }}
      </div>
    </Card>

    <Card class="xl:col-span-2" title="行为验证码组件测试" size="small">
      <p class="text-muted-foreground mb-3">
        四种行为验证码均使用本地模拟挑战，完成结果只在当前页面显示，不请求验证接口。
      </p>
      <Radio.Group v-model:value="captchaMode" class="mb-4" button-style="solid">
        <Radio.Button value="CLICK">点选</Radio.Button>
        <Radio.Button value="IDIOM_CLICK">成语点选</Radio.Button>
        <Radio.Button value="SLIDE">滑块</Radio.Button>
        <Radio.Button value="OBSTACLE_AVOIDANCE">躲避障碍</Radio.Button>
      </Radio.Group>
      <BehaviorCaptcha
        :challenge="captchaChallenge"
        @complete="onCaptchaComplete"
      />
      <div class="mt-3">
        <Tag color="green">{{ captchaResult }}</Tag>
      </div>
    </Card>
  </div>
</template>
