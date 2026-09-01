<script lang="ts" setup>
import { javascript } from '@codemirror/lang-javascript';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modelValue?: string;
  }>(),
  { disabled: false, modelValue: '' },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const host = ref<HTMLElement>();
let editor: EditorView | undefined;
let syncing = false;

function buildExtensions() {
  return [
    lineNumbers(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    javascript(),
    EditorView.editable.of(!props.disabled),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !syncing) {
        emit('update:modelValue', update.state.doc.toString());
      }
    }),
    EditorView.theme({
      '&': {
        backgroundColor: 'hsl(var(--input-background))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '6px',
        color: 'hsl(var(--foreground))',
        height: '100%',
        minHeight: '0',
        width: '100%',
      },
      '.cm-content': { caretColor: 'hsl(var(--foreground))', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-gutters': { backgroundColor: 'hsl(var(--muted))', borderRight: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' },
      '.cm-activeLine': { backgroundColor: 'hsl(var(--accent))' },
      '.cm-activeLineGutter': { backgroundColor: 'hsl(var(--accent))' },
    }),
  ];
}

function focus() {
  editor?.focus();
}

function insertText(text: string) {
  if (!editor || props.disabled) return;
  const selection = editor.state.selection.main;
  editor.dispatch({
    changes: { from: selection.from, to: selection.to, insert: text },
    selection: { anchor: selection.from + text.length },
  });
  focus();
}

onMounted(() => {
  if (!host.value) return;
  editor = new EditorView({
    parent: host.value,
    state: EditorState.create({ doc: props.modelValue, extensions: buildExtensions() }),
  });
});

onBeforeUnmount(() => editor?.destroy());

watch(() => props.modelValue, async (value) => {
  await nextTick();
  if (!editor || editor.state.doc.toString() === value) return;
  syncing = true;
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value || '' } });
  syncing = false;
});

defineExpose({ focus, insertText });
</script>

<template><div ref="host" class="h-full w-full" /></template>
