import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: frontendRoot,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const artifact = resolve(
  frontendRoot,
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/data-attr-contract.json',
);
const contract = JSON.parse(readFileSync(artifact, 'utf8'));
if (contract.version !== 1 || !contract.policies?.length) {
  throw new Error(`静态字段契约为空或版本不支持：${artifact}`);
}
const identities = new Set();
for (const policy of contract.policies) {
  if (
    !policy.id ||
    identities.has(policy.id) ||
    !Array.isArray(policy.pathPatterns) ||
    policy.pathPatterns.length === 0 ||
    !Array.isArray(policy.methods) ||
    !Array.isArray(policy.groups) ||
    policy.groups.some((group) => 'allowed' in group)
  ) {
    throw new Error(`静态字段契约标识、路由或分组非法：${policy.id}`);
  }
  identities.add(policy.id);
}

// 源码仓联动检查编译后的真实注解，纯前端消费工程只检查交付的静态结构。
const exporter = resolve(
  frontendRoot,
  '../../scripts/export-static-data-attr-contract.sh',
);
if (existsSync(exporter)) {
  run('bash', [exporter, '--check']);
} else {
  console.log(
    '静态结构检查通过；后端源码不在当前工程，注解一致性须由所属后端导出门禁验证。',
  );
}

// 使用与浏览器完全相同的注册校验器，检查所有节点/分组引用及真实授权合并。
run('pnpm', [
  'exec',
  'vitest',
  'run',
  '--dom',
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/__tests__/static-field-contract.test.ts',
]);
