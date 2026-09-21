import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../runtime', () => ({ requestClient: { get } }));

import { fetchDictOptions } from '../api';

describe('dict option cache', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('reuses 304 candidates and sends the prior ETag', async () => {
    get
      .mockResolvedValueOnce({
        data: { data: { itemList: [{ code: 'CNY', name: '人民币' }] } },
        headers: { etag: '"dict-v1"' },
        status: 200,
      })
      .mockResolvedValueOnce({ data: null, headers: {}, status: 304 });

    await expect(fetchDictOptions('CurrencyCode')).resolves.toEqual([
      expect.objectContaining({ label: '人民币', value: 'CNY' }),
    ]);
    await expect(fetchDictOptions('CurrencyCode')).resolves.toEqual([
      expect.objectContaining({ label: '人民币', value: 'CNY' }),
    ]);

    expect(get).toHaveBeenLastCalledWith(
      '/Dict/retrieveByCode',
      expect.objectContaining({ headers: { 'If-None-Match': '"dict-v1"' } }),
    );
  });
});
