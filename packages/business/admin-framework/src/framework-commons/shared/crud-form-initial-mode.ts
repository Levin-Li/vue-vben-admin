import type {
  CrudFormInitialMode,
  CrudPageDisplayFormViewConfig,
} from './types';

/** 优先使用新设置；旧值保留用户显式开启或关闭，缺省采用自动模式。 */
export function resolveCrudInitialMode(
  config?: Pick<CrudPageDisplayFormViewConfig, 'initialMode' | 'quickFill'>,
): CrudFormInitialMode {
  if (config?.initialMode) return config.initialMode;
  if (config?.quickFill === true) return 'quick';
  if (config?.quickFill === false) return 'normal';
  return 'auto';
}

/** 计算首次视图与退出精简视图后返回的完整布局。 */
export function resolveCrudFormMode(
  config:
    | Pick<CrudPageDisplayFormViewConfig, 'initialMode' | 'quickFill'>
    | undefined,
  options: {
    brief: boolean;
    quick: boolean;
    view: 'create' | 'edit';
    wizard: boolean;
  },
) {
  const mode =
    !config?.initialMode && config?.quickFill === false && options.brief
      ? 'brief'
      : resolveCrudInitialMode(config);
  const layout = options.wizard && mode !== 'normal' ? 'wizard' : 'normal';
  let compact: 'brief' | 'quick' | undefined;
  let reason: string | undefined;
  if (mode === 'brief' || (mode === 'auto' && options.brief)) {
    if (options.brief) compact = 'brief';
    else reason = '简要表单当前不可用，已显示完整表单';
  } else if (mode === 'wizard' && !options.wizard) {
    reason = '有效分组不足三组，已显示普通表单';
  } else if (mode === 'quick') {
    if (options.quick) compact = 'quick';
    else reason = '没有可填写的必填字段，已显示完整表单';
  } else if (
    mode === 'auto' &&
    options.view === 'create' &&
    options.quick
  ) {
    compact = 'quick';
  }
  return { layout, compact, reason } as const;
}

export const crudInitialModeOptions = [
  { label: '默认', value: 'auto' },
  { label: '简要表单', value: 'brief' },
  { label: '向导', value: 'wizard' },
  { label: '快捷', value: 'quick' },
  { label: '普通', value: 'normal' },
];
