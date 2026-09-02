import { describe, expect, it } from 'vitest';

import {
  getSettingJsonSchemaSource,
  resolveSettingEditorKind,
} from '../setting-for-tenant';

describe('service plugin provider configuration editor', () => {
  it('preserves an inner Java configuration type binary name', () => {
    const setting = {
      editor:
        'class:org.dromara.x.file.storage.core.FileStorageProperties$AliyunOssConfig',
      valueType: 'Json',
    };

    expect(getSettingJsonSchemaSource(setting)).toEqual({
      kind: 'java-type',
      typeGenericStr:
        'org.dromara.x.file.storage.core.FileStorageProperties$AliyunOssConfig',
    });
    expect(resolveSettingEditorKind(setting)).toBe('json-schema');
  });

  it('uses the normal JSON editor when a Json setting has no editor declaration', () => {
    expect(resolveSettingEditorKind({ editor: '', type: 'Json' })).toBe('json');
  });
});
