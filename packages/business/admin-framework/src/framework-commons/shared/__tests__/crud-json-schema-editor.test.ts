import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'packages/business/admin-framework/src/framework-commons/shared/crud-page.vue',
  'utf8',
);

describe('crud json schema editor integration', () => {
  it('renders schema-aware json fields before falling back to the generic json editor', () => {
    const jsonSchemaBranch = source.indexOf('<JsonSchemaEditorField');
    const jsonEditorBranch = source.indexOf('<JsonEditorField');

    expect(jsonSchemaBranch).toBeGreaterThan(-1);
    expect(jsonEditorBranch).toBeGreaterThan(-1);
    expect(source).toContain(
      'shouldUseJsonSchemaEditor(field, formState[field.key])',
    );
    expect(source).toContain(
      '!shouldUseJsonSchemaEditor(field, formState[field.key])',
    );
  });

  it('passes schema metadata and display mode into the schema editor without mutating field config', () => {
    expect(source).toContain('getJsonSchemaSourceInput(field, formState[field.key])');
    expect(source).toContain(':inline="isCrudFieldJsonSchemaInline(field)"');
    expect(source).toContain(':modal-width="modalWidth"');
    expect(source).toContain(':modal-style="modalStyle"');
  });
});
