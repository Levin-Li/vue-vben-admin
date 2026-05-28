import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const viewsDir =
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views';

function listConfigFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return listConfigFiles(path);
    }

    return entry === 'config.ts' ? [path] : [];
  });
}

const compactJsonFields = [
  'client-app/config.ts:exInfo',
  'demo/config.ts:jsonData',
  'domain/config.ts:nameservers',
  'domain/config.ts:exInfo',
  'domain-ssl-cert/config.ts:exInfo',
  'file-res/config.ts:exInfo',
  'fund-account-log/config.ts:tradeLog',
  'fund-account-log/config.ts:extInfo',
  'org/config.ts:exInfo',
  'role/config.ts:exInfo',
  'simple-form/config.ts:setting',
  'simple-page/config.ts:setting',
  'social-user/config.ts:exInfo',
  'tenant/config.ts:uiExInfo',
  'tenant/config.ts:exInfo',
  'tenant-app/config.ts:exInfo',
  'tenant-site/config.ts:uiExInfo',
  'tenant-site/config.ts:exInfo',
  'user/config.ts:exInfo',
];

const wideJsonFields = [
  'domain/config.ts:dnsRecords',
  'import-export-template/config.ts:config',
  'pay-channel/config.ts:detailInfo',
  'pay-order/config.ts:payInfo',
  'pay-order/config.ts:exchangeInfo',
  'scheduled-task/config.ts:schedulerConfig',
  'scheduled-task/config.ts:runParams',
  'service-plugin/config.ts:exInfo',
  'traffic-control-rule/config.ts:exInfo',
  'url-ex-acl/config.ts:exInfo',
];

function hasExplicitWideJsonLayout(source: string, key: string) {
  const escapedKey = key.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const objectPattern = new RegExp(
    `\\{[^{}]*key:\\s*['"]${escapedKey}['"][^{}]*type:\\s*['"]json['"][^{}]*\\}`,
    's',
  );
  const objectSource = source.match(objectPattern)?.[0] || '';

  return /fullRow:\s*true|span:\s*-1/.test(objectSource);
}

function fieldIndex(source: string, key: string) {
  const escapedKey = key.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`key:\\s*['"]${escapedKey}['"]`));

  return match?.index ?? -1;
}

describe('json field layout rules', () => {
  it('keeps page-level compact json fields free of explicit full-row layout', () => {
    const sourceByFile = new Map(
      listConfigFiles(viewsDir).map((file) => [file, readFileSync(file, 'utf8')]),
    );
    const offenders = compactJsonFields.filter((entry) => {
      const [relativeFile, key] = entry.split(':');
      const file = join(viewsDir, relativeFile!);
      const source = sourceByFile.get(file);

      return source ? hasExplicitWideJsonLayout(source, key!) : false;
    });

    expect(offenders).toEqual([]);
  });

  it('keeps reviewed complex json fields explicitly full-row', () => {
    const sourceByFile = new Map(
      listConfigFiles(viewsDir).map((file) => [
        file,
        readFileSync(file, 'utf8'),
      ]),
    );
    const offenders = wideJsonFields.filter((entry) => {
      const [relativeFile, key] = entry.split(':');
      const file = join(viewsDir, relativeFile!);
      const source = sourceByFile.get(file);

      return source ? !hasExplicitWideJsonLayout(source, key!) : true;
    });

    expect(offenders).toEqual([]);
  });

  it('keeps reviewed layout-only field groupings aligned', () => {
    const sourceByFile = new Map(
      listConfigFiles(viewsDir).map((file) => [
        file,
        readFileSync(file, 'utf8'),
      ]),
    );
    const indexOf = (relativeFile: string, key: string) =>
      fieldIndex(sourceByFile.get(join(viewsDir, relativeFile)) || '', key);

    expect(indexOf('demo/config.ts', 'jsonData')).toBeLessThan(
      indexOf('demo/config.ts', 'htmlData'),
    );
    expect(indexOf('org/config.ts', 'emails')).toBeLessThan(
      indexOf('org/config.ts', 'zipCode'),
    );
    expect(indexOf('org/config.ts', 'zipCode')).toBeLessThan(
      indexOf('org/config.ts', 'address'),
    );
    expect(indexOf('org/config.ts', 'orderCode')).toBeLessThan(
      indexOf('org/config.ts', 'exInfo'),
    );
    expect(indexOf('simple-page/config.ts', 'orderCode')).toBeLessThan(
      indexOf('simple-page/config.ts', 'setting'),
    );
    expect(indexOf('simple-page/config.ts', 'setting')).toBeLessThan(
      indexOf('simple-page/config.ts', 'enable'),
    );
    expect(indexOf('tenant/config.ts', 'appAuthDomain')).toBeLessThan(
      indexOf('tenant/config.ts', 'appSecret'),
    );
  });
});
