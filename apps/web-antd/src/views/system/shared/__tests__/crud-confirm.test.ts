import { describe, expect, it } from 'vitest';

import { buildCrudConfirmConfig } from '../crud-confirm';

describe('crud-confirm', () => {
  it('does not require confirmation for empty confirm text', () => {
    expect(buildCrudConfirmConfig()).toEqual({
      enabled: false,
    });
  });

  it('does not require confirmation when confirm text is None', () => {
    expect(buildCrudConfirmConfig('None')).toEqual({
      enabled: false,
    });
  });

  it('uses confirm text and title when provided', () => {
    expect(buildCrudConfirmConfig('确认发布吗？', '发布确认')).toEqual({
      enabled: true,
      text: '确认发布吗？',
      title: '发布确认',
    });
  });
});
