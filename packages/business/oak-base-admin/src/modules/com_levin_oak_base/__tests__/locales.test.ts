import { describe, expect, it } from 'vitest';

import { oakBaseAdminLocales } from '../locales';

describe('oak base admin locales', () => {
  it('loads locale json files from the standard locales glob', () => {
    expect(oakBaseAdminLocales).toMatchObject({
      'en-US': {
        oakBaseAdmin: {
          moduleTitle: 'Base Module',
        },
      },
      'zh-CN': {
        oakBaseAdmin: {
          moduleTitle: '基础模块',
        },
      },
    });
  });
});
