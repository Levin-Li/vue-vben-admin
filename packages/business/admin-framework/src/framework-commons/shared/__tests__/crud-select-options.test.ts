import { describe, expect, it } from 'vitest';

import {
  shouldApplyFieldOptionsRequest,
  shouldReloadRemoteOptionsOnDropdownOpen,
} from '../crud-select-options';

describe('crud select options', () => {
  it('reloads default options when a remote-search dropdown opens', () => {
    expect(
      shouldReloadRemoteOptionsOnDropdownOpen({
        key: 'roleList',
        label: '角色列表',
        loadOptions: async () => [],
        remoteSearch: true,
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
});
