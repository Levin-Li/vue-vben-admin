import { describe, expect, it, vi } from 'vitest';

import { fundAccountPageCrudConfig } from '../config';

vi.mock('../../../api/fund-account-service', () => ({
  fundAccountService: {},
}));

vi.mock('../../api-module', () => ({
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 'min(80vw, 1280px)',
  tenantOptionsLoader: async () => [],
}));

describe('fund account page config', () => {
  it('keeps currency fields visible but immutable in edit forms', () => {
    for (const key of ['currencyType', 'currencyCode']) {
      const field = fundAccountPageCrudConfig.fields.find(
        (item) => item.key === key,
      );

      expect(field, key).toMatchObject({
        disabledOnEdit: true,
        omitOnEdit: true,
      });
    }
  });
});
