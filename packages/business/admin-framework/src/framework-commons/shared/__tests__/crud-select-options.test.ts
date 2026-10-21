import { describe, expect, it } from 'vitest';

import {
  reconcileInitialChoiceValue,
  shouldApplyFieldOptionsRequest,
  shouldLoadFieldOptions,
  shouldReloadRemoteOptionsOnDropdownOpen,
} from '../crud-select-options';

describe('crud select options', () => {
  it('loads backend options only when the dropdown opens', () => {
    expect(
      shouldReloadRemoteOptionsOnDropdownOpen({
        key: 'roleList',
        label: '角色列表',
        loadOptions: async () => [],
        remoteSearch: false,
      }),
    ).toBe(true);
  });

  it('does not reload local option fields on dropdown open', () => {
    expect(
      shouldReloadRemoteOptionsOnDropdownOpen({
        key: 'type',
        label: '类型',
        options: [{ label: '普通', value: 'Normal' }],
        remoteSearch: false,
      }),
    ).toBe(false);
  });

  it('applies only the latest async options request result', () => {
    expect(shouldApplyFieldOptionsRequest(2, 2)).toBe(true);
    expect(shouldApplyFieldOptionsRequest(1, 2)).toBe(false);
  });

  it('does not load options for a field hidden from the current user', () => {
    expect(shouldLoadFieldOptions(true, false)).toBe(false);
    expect(shouldLoadFieldOptions(true, true)).toBe(true);
  });

  it('converts an unchanged initial value after remote options arrive', () => {
    const field = { key: 'channel', label: '频道', type: 'select' } as const;
    const options = [{ label: '频道一', value: '1' }];

    expect(reconcileInitialChoiceValue(field, 1, 1, options)).toBe('1');
    expect(reconcileInitialChoiceValue(field, 1, 2, options)).toBe(2);
    expect(reconcileInitialChoiceValue(field, 3, 3, options)).toBe(3);
  });
});
