import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

// 锁定两个独立合作伙伴页面的字段和枚举契约。
describe('合作伙伴类型字段', () => {
  it.each(['supplier-partner', 'channel-partner'])(
    '%s 仅配置单值 type',
    (resource) => {
      const source = readFileSync(
        resolve(
          process.cwd(),
          `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/${resource}/config.ts`,
        ),
        'utf8',
      );
      const entity =
        resource === 'supplier-partner' ? 'SupplierPartner' : 'ChannelPartner';

      expect(source).toContain("key: 'type'");
      expect(source).toContain(`entities.${entity}$Type`);
      expect(source).not.toMatch(
        /supplierTypes|channelType|storeMode|multiple: true/,
      );
    },
  );

  it.each(['partner', 'customer'])('%s 使用公共投资关系枚举', (resource) => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/${resource}/config.ts`,
      ),
      'utf8',
    );

    expect(source).toContain(
      'com.levin.oak.base.entities.enums.InvestmentRelation',
    );
    expect(source).not.toContain('$InvestmentRelation');
  });
});
