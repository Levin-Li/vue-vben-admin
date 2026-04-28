import { describe, expect, it } from 'vitest';

import {
  normalizeCrudAction,
  pickCrudActionResultData,
  resolveCrudActionAfterSuccess,
  shouldReloadDataListAfterAction,
} from '../crud-action-model';

describe('crud-action-model', () => {
  it('normalizes Auto action on controller methods to Ajax', () => {
    expect(normalizeCrudAction()).toBe('ajax');
    expect(normalizeCrudAction('Auto')).toBe('ajax');
    expect(normalizeCrudAction('Link')).toBe('link');
    expect(normalizeCrudAction('ShowForm')).toBe('showForm');
  });

  it('resolves Auto success action to ReloadDataList for ajax operations', () => {
    expect(resolveCrudActionAfterSuccess('Ajax', 'Auto')).toBe(
      'reloadDataList',
    );
  });

  it('keeps explicit success action unchanged', () => {
    expect(resolveCrudActionAfterSuccess('Ajax', 'ShowForm')).toBe('showForm');
  });

  it('detects whether an operation should reload the data list', () => {
    expect(shouldReloadDataListAfterAction('Ajax', 'Auto')).toBe(true);
    expect(shouldReloadDataListAfterAction('Ajax', 'ReloadDataList')).toBe(
      true,
    );
    expect(shouldReloadDataListAfterAction('Ajax', 'ShowForm')).toBe(false);
  });

  it('picks result action data with path expressions', () => {
    expect(
      pickCrudActionResultData(
        {
          data: {
            detail: {
              url: 'https://example.com',
            },
          },
        },
        '$' + '{data.detail.url}',
      ),
    ).toBe('https://example.com');
  });

  it('returns whole response when resultActionData is empty', () => {
    const response = { data: { id: '1' } };
    expect(pickCrudActionResultData(response, '')).toBe(response);
  });
});
