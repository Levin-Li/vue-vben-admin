import { describe, expect, it } from 'vitest';

import {
  JSON_SCHEMA_API_MODULE,
  jsonSchemaService,
} from '../json-schema-service';

describe('json schema service', () => {
  it('uses the Oak base API module for generated schemas', () => {
    expect(jsonSchemaService.buildRequestPath('genJsonSchema')).toBe(
      `${JSON_SCHEMA_API_MODULE}/jsonSchema/genJsonSchema`,
    );
  });
});
