import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const frontendRoot = resolve(import.meta.dirname, '..');
const projectRoot = resolve(frontendRoot, '../..');
const apiRoot = join(
  frontendRoot,
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/api',
);
const entityRoot = join(
  projectRoot,
  'entities/src/main/java/com/levin/oak/base/entities',
);

if (existsSync(entityRoot)) {
  const errors = [];
  for (const entry of readdirSync(apiRoot)) {
    if (!entry.endsWith('-service.ts')) continue;
    const source = readFileSync(join(apiRoot, entry), 'utf8');
    const entityName = source.match(
      /refEntityClass:\s*['"]com\.levin\.oak\.base\.entities\.(\w+)['"]/,
    )?.[1];
    if (!entityName) continue;
    const entityFile = join(entityRoot, `${entityName}.java`);
    if (!existsSync(entityFile)) continue;
    const category = readFileSync(entityFile, 'utf8').match(
      /@EntityCategory\(EntityOpConst\.(BIZ|SYS)_TYPE_NAME\)/,
    )?.[1];
    if (!category) continue;
    const unexpected = category === 'BIZ' ? '系统数据-' : '业务数据-';
    if (new RegExp(String.raw`\btype:\s*['"]${unexpected}`).test(source)) {
      errors.push(`${entry}: ${entityName} 的实体类别与前端服务权限类型不一致`);
    }
  }
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('前端 API 资源类型与后端实体类别一致\n');
  }
} else {
  process.stdout.write('后端实体源码不可用，跳过跨仓库资源类型核对\n');
}
