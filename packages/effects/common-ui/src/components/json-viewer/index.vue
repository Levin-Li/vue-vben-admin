<script lang="ts" setup>
import type { SetupContext } from 'vue';

import type { Recordable } from '@vben/types';

import type {
  JsonViewerAction,
  JsonViewerProps,
  JsonViewerToggle,
  JsonViewerValue,
} from './types';

import { computed, useAttrs } from 'vue';
// @ts-ignore
import VueJsonViewer from 'vue-json-viewer';

import { $t } from '@vben/locales';

import { isBoolean } from '@vben-core/shared/utils';

// @ts-ignore
import JsonBigint from 'json-bigint';

defineOptions({ name: 'JsonViewer' });

const props = withDefaults(defineProps<JsonViewerProps>(), {
  expandDepth: 1,
  copyable: false,
  sort: false,
  boxed: false,
  theme: 'default-json-theme',
  expanded: false,
  previewMode: false,
  showArrayIndex: true,
  showDoubleQuotes: false,
});

const emit = defineEmits<{
  click: [event: MouseEvent];
  copied: [event: JsonViewerAction];
  keyClick: [key: string];
  toggle: [param: JsonViewerToggle];
  valueClick: [value: JsonViewerValue];
}>();

const attrs: SetupContext['attrs'] = useAttrs();

function handleClick(event: MouseEvent) {
  if (
    event.target instanceof HTMLElement &&
    event.target.classList.contains('jv-item')
  ) {
    const pathNode = event.target.closest('.jv-push');
    if (!pathNode || !pathNode.hasAttribute('path')) {
      return;
    }
    const param: JsonViewerValue = {
      el: event.target,
      path: pathNode.getAttribute('path') || '',
      depth: Number(pathNode.getAttribute('depth')) || 0,
      value: event.target.textContent || undefined,
    };

    param.value = JSON.parse(param.value);
    emit('valueClick', param);
  }
  emit('click', event);
}

// 支持显示 bigint 数据，如较长的订单号
const jsonData = computed<Record<string, any>>(() => {
  if (typeof props.value !== 'string') {
    return props.value || {};
  }

  try {
    return JsonBigint({ storeAsString: true }).parse(props.value);
  } catch (error) {
    console.error('JSON parse error:', error);
    return {};
  }
});

const bindProps = computed<Recordable<any>>(() => {
  const copyable = {
    copyText: $t('ui.jsonViewer.copy'),
    copiedText: $t('ui.jsonViewer.copied'),
    timeout: 2000,
    ...(isBoolean(props.copyable) ? {} : props.copyable),
  };

  return {
    ...props,
    ...attrs,
    value: jsonData.value,
    onCopied: (event: JsonViewerAction) => emit('copied', event),
    onKeyclick: (key: string) => emit('keyClick', key),
    onClick: (event: MouseEvent) => handleClick(event),
    copyable: props.copyable ? copyable : false,
  };
});
</script>
<template>
  <VueJsonViewer v-bind="bindProps">
    <template #copy="slotProps">
      <slot name="copy" v-bind="slotProps"></slot>
    </template>
  </VueJsonViewer>
</template>
<style lang="scss">
.default-json-theme {
  font-family: Consolas, Menlo, Courier, monospace;
  font-size: 14px;
  color: hsl(var(--foreground));
  white-space: nowrap;
  background: hsl(var(--background));

  &.jv-container.boxed {
    border: 1px solid hsl(var(--border));
  }

  .jv-ellipsis {
    display: inline-block;
    padding: 0 4px 2px;
    font-size: 0.9em;
    line-height: 0.9;
    vertical-align: 2px;
    color: hsl(var(--secondary-foreground));
    cursor: pointer;
    user-select: none;
    background-color: hsl(var(--secondary));
    border-radius: 3px;
  }

  .jv-button {
    color: hsl(var(--primary));
  }

  .jv-key {
    color: hsl(var(--heavy-foreground));
  }

  .jv-item {
    &.jv-array {
      color: hsl(var(--heavy-foreground));
    }

    &.jv-boolean {
      color: hsl(var(--red-400));
    }

    &.jv-function {
      color: hsl(var(--destructive-foreground));
    }

    &.jv-number {
      color: hsl(var(--info-foreground));
    }

    &.jv-number-float {
      color: hsl(var(--info-foreground));
    }

    &.jv-number-integer {
      color: hsl(var(--info-foreground));
    }

    &.jv-object {
      color: hsl(var(--accent-darker));
    }

    &.jv-undefined {
      color: hsl(var(--secondary-foreground));
    }

    &.jv-string {
      color: hsl(var(--primary));
      overflow-wrap: break-word;
      white-space: normal;
    }
  }

  &.jv-container .jv-code {
    padding: 10px;

    &.boxed:not(.open) {
      padding-bottom: 20px;
      margin-bottom: 10px;
    }

    &.open {
      padding-bottom: 10px;
    }

    .jv-toggle {
      &::before {
        padding: 0 2px;
        border-radius: 2px;
      }

      &:hover {
        &::before {
          background: hsl(var(--accent-foreground));
        }
      }
    }
  }
}
</style>
