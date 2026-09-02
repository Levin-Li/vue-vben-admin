<script lang="ts" setup>
import type { AdministrativeAreaNode } from '@levin/admin-framework/framework-commons/shared/administrative-area-data';

import { computed, ref, watch } from 'vue';

import {
  formatAdministrativeArea,
  getAdministrativeAreaOptions,
} from '@levin/admin-framework/framework-commons/shared/administrative-area-data';
import { Button, Checkbox, Collapse, Input, Modal } from 'ant-design-vue';

import {
  compactOpenAreaCodeList,
  filterOpenAreaTree,
  isOpenAreaCodeCovered,
  normalizeOpenAreaCodeList,
  shouldFilterOpenAreaTree,
  toggleOpenAreaCode,
} from './open-area-code-tree-selection';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modelValue?: string[];
    originalValue?: string[];
  }>(),
  {
    disabled: false,
    modelValue: () => [],
    originalValue: () => [],
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const expandedProvinceCodes = ref<string[]>([]);
const searchKeyword = ref('');
const areas = computed(() => getAdministrativeAreaOptions());
const filteredAreas = computed(() =>
  filterOpenAreaTree(areas.value, searchKeyword.value),
);
const selectedCodes = computed(() =>
  compactOpenAreaCodeList(props.modelValue, areas.value),
);
const sortedSelectedCodes = computed(() =>
  selectedCodes.value.toSorted((left, right) => left.localeCompare(right)),
);
const originalSelectedCodes = computed(() =>
  compactOpenAreaCodeList(props.originalValue, areas.value),
);
const canRestoreOriginalSelection = computed(
  () =>
    selectedCodes.value.toSorted().join('\u0000') !==
    originalSelectedCodes.value.toSorted().join('\u0000'),
);

watch(
  selectedCodes,
  (codes) => {
    const selectedProvinceCodes = areas.value
      .filter((province) =>
        codes.some((code) => isOpenAreaCodeCovered(code, province.code)),
      )
      .map((province) => province.code);

    expandedProvinceCodes.value = [
      ...new Set([...expandedProvinceCodes.value, ...selectedProvinceCodes]),
    ];
  },
  { immediate: true },
);

watch([searchKeyword, filteredAreas], ([keyword, matchedAreas]) => {
  if (!shouldFilterOpenAreaTree(keyword)) {
    return;
  }

  expandedProvinceCodes.value = [
    ...new Set([
      ...expandedProvinceCodes.value,
      ...matchedAreas.map((area) => area.code),
    ]),
  ];
});

watch(
  () => props.modelValue,
  (value) => {
    const compactedCodes = compactOpenAreaCodeList(value, areas.value);
    const normalizedCodes = normalizeOpenAreaCodeList(value);

    if (compactedCodes.some((code, index) => code !== normalizedCodes[index])) {
      emit('update:modelValue', compactedCodes);
    }
  },
  { deep: true, immediate: true },
);

function isSelected(code: string) {
  return selectedCodes.value.some((rangeCode) =>
    isOpenAreaCodeCovered(rangeCode, code),
  );
}

function applyCodeChange(code: string, checked: boolean) {
  emit(
    'update:modelValue',
    compactOpenAreaCodeList(
      toggleOpenAreaCode(selectedCodes.value, code, checked),
      areas.value,
    ),
  );
}

function updateCode(code: string, checked: boolean) {
  if (checked) {
    applyCodeChange(code, true);
    return;
  }

  Modal.confirm({
    cancelText: '取消',
    content: `取消“${formatAdministrativeArea(code)}”后，该范围将不再开通。`,
    okText: '确认删除',
    onOk: () => applyCodeChange(code, false),
    title: '确认取消已开通区域？',
  });
}

function restoreOriginalSelection() {
  Modal.confirm({
    cancelText: '取消',
    content: '恢复后会放弃本次弹窗内对开通区域的调整。',
    okText: '确认恢复',
    onOk: () => emit('update:modelValue', [...originalSelectedCodes.value]),
    title: '确认恢复原选区域？',
  });
}

function getCityNodes(province: AdministrativeAreaNode) {
  return (province.children || []).filter((node) => node.level === 'city');
}

function getDistrictNodes(node: AdministrativeAreaNode) {
  return (node.children || []).filter((child) => child.level === 'district');
}

function getDirectDistrictNodes(province: AdministrativeAreaNode) {
  return (province.children || []).filter((node) => node.level === 'district');
}
</script>

<template>
  <div class="open-area-code-tree-selector">
    <p class="text-muted-foreground mb-3 text-sm">
      勾选省或市即开通全部下级区域；仅勾选区县时只开通该区县。留空表示不限制。
    </p>
    <div
      class="grid h-[min(66vh,680px)] min-h-0 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_280px]"
    >
      <section class="flex min-h-0 min-w-0 flex-col">
        <Input
          :value="searchKeyword"
          allow-clear
          class="mb-3"
          placeholder="搜索省、市、区县名称"
          @update:value="searchKeyword = String($event || '')"
        />
        <div class="min-h-0 flex-1 overflow-y-auto pr-1">
          <Collapse
            v-model:active-key="expandedProvinceCodes"
            class="rounded-md border"
          >
            <Collapse.Panel
              v-for="province in filteredAreas"
              :key="province.code"
            >
              <template #header>
                <Checkbox
                  :checked="isSelected(province.code)"
                  :disabled="disabled"
                  @click.stop
                  @change="
                    (event) => updateCode(province.code, event.target.checked)
                  "
                >
                  {{ province.name }}
                </Checkbox>
              </template>

              <div class="space-y-4 px-1 py-2">
                <section
                  v-for="city in getCityNodes(province)"
                  :key="city.code"
                  class="border-border border-l-2 pl-3"
                >
                  <Checkbox
                    :checked="isSelected(city.code)"
                    :disabled="disabled"
                    @change="
                      (event) => updateCode(city.code, event.target.checked)
                    "
                  >
                    {{ city.name }}
                  </Checkbox>
                  <div class="mt-2 flex flex-wrap gap-x-4 gap-y-2 pl-6">
                    <Checkbox
                      v-for="district in getDistrictNodes(city)"
                      :key="district.code"
                      :checked="isSelected(district.code)"
                      :disabled="disabled"
                      @change="
                        (event) =>
                          updateCode(district.code, event.target.checked)
                      "
                    >
                      {{ district.name }}
                    </Checkbox>
                  </div>
                </section>

                <section
                  v-if="getDirectDistrictNodes(province).length > 0"
                  class="border-border border-l-2 pl-3"
                >
                  <div class="mb-2 text-sm">区县</div>
                  <div class="flex flex-wrap gap-x-4 gap-y-2">
                    <Checkbox
                      v-for="district in getDirectDistrictNodes(province)"
                      :key="district.code"
                      :checked="isSelected(district.code)"
                      :disabled="disabled"
                      @change="
                        (event) =>
                          updateCode(district.code, event.target.checked)
                      "
                    >
                      {{ district.name }}
                    </Checkbox>
                  </div>
                </section>
              </div>
            </Collapse.Panel>
          </Collapse>
          <div
            v-if="
              shouldFilterOpenAreaTree(searchKeyword) &&
              filteredAreas.length === 0
            "
            class="text-muted-foreground py-6 text-center text-sm"
          >
            未找到匹配的行政区划
          </div>
        </div>
      </section>

      <aside
        class="border-border min-h-0 overflow-y-auto rounded-md border p-3"
      >
        <div class="mb-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium">已选区域</span>
          <Button
            :disabled="disabled || !canRestoreOriginalSelection"
            size="small"
            type="link"
            @click="restoreOriginalSelection"
          >
            恢复原选区域
          </Button>
        </div>
        <div
          v-if="selectedCodes.length === 0"
          class="text-muted-foreground py-3 text-sm"
        >
          未限制（全国）
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="code in sortedSelectedCodes"
            :key="code"
            class="border-border flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-b-0"
          >
            <span class="min-w-0 flex-1 break-words">
              {{ formatAdministrativeArea(code) }}
            </span>
            <Button
              v-if="!disabled"
              danger
              size="small"
              type="link"
              @click="updateCode(code, false)"
            >
              删除
            </Button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
