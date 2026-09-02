import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/setting-value-content-field.vue',
  'utf8',
);

describe('setting value content field', () => {
  it('uses JsonViewer for readonly ordinary JSON values before the editor branch', () => {
    const viewerBranch = source.indexOf(
      'v-else-if="disabled && editorKind === \'json\'"',
    );
    const editorBranch = source.indexOf('v-else-if="editorKind === \'json\'"');

    expect(source).toContain("import { JsonViewer } from '@vben/common-ui'");
    expect(viewerBranch).toBeGreaterThan(-1);
    expect(editorBranch).toBeGreaterThan(viewerBranch);
  });

  it('allows UiSetting pages to force the normal JSON branch when editor is absent', () => {
    expect(source).toContain('forceJsonWhenEditorMissing');
    expect(source).toContain("return 'json';");
  });
});
