import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagesRoot = resolve(frontendRoot, 'packages');
const frameworkRoot = resolve(packagesRoot, 'business/admin-framework');
const outputPath = resolve(
  frameworkRoot,
  'src/framework-commons/app/framework-package-metadata.ts',
);
const metadataFiles = ['package-version.mjs', 'package-version.d.mts'];
const declaration =
  'export declare const packageVersion: {\n  name: string;\n  version: string;\n  buildTime: string;\n};\n';
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const packageIndex = args.indexOf('--package');
if (packageIndex !== -1 && !args[packageIndex + 1])
  throw new Error('--package 必须指定包目录');
const targetRoot =
  packageIndex >= 0 ? realpathSync(resolve(args[packageIndex + 1])) : undefined;

function readPackage(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function collectPublishedPackages(directory, packages = new Map()) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['dist', 'node_modules'].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) collectPublishedPackages(path, packages);
    else if (entry.name === 'package.json') {
      const manifest = readPackage(path);
      if (manifest.name && manifest.private !== true)
        packages.set(manifest.name, { manifest, root: directory });
    }
  }
  return packages;
}
const publishedPackages = collectPublishedPackages(packagesRoot);
const framework = readPackage(resolve(frameworkRoot, 'package.json'));
const names = Object.keys({
  ...framework.dependencies,
  ...framework.peerDependencies,
})
  .filter((name) => publishedPackages.has(name))
  .toSorted();
const trackedPackages = [
  ...new Set(['@levin/oak-base-admin', framework.name, ...names]),
]
  .map((name) => publishedPackages.get(name))
  .filter(Boolean);
if (targetRoot && !trackedPackages.some((pkg) => pkg.root === targetRoot))
  throw new Error('--package 目录不是受管理的框架发布包');

function validateExports({ manifest }) {
  for (const exports of [
    manifest.exports,
    manifest.publishConfig?.exports || manifest.exports,
  ]) {
    const entry = exports?.['./package-version'];
    if (
      entry?.types !== './package-version.d.mts' ||
      entry?.default !== './package-version.mjs'
    )
      throw new Error(
        `${manifest.name} 必须公开 ./package-version 普通 JavaScript 和类型入口`,
      );
  }
  if (!metadataFiles.every((file) => manifest.files?.includes(file)))
    throw new Error(`${manifest.name} 发布文件清单缺少包版本元数据`);
}
async function validateMetadata({ manifest, root }) {
  if (!metadataFiles.every((file) => existsSync(resolve(root, file))))
    throw new Error(`${manifest.name} 缺少包版本元数据，请先构建该包`);
  const { packageVersion } = await import(
    pathToFileURL(resolve(root, metadataFiles[0])).href
  );
  if (
    packageVersion?.name !== manifest.name ||
    packageVersion?.version !== manifest.version
  )
    throw new Error(`${manifest.name} 元数据版本已过期，请单独构建该包`);
  const time = packageVersion?.buildTime;
  if (
    typeof time !== 'string' ||
    !Number.isFinite(Date.parse(time)) ||
    new Date(time).toISOString() !== time
  )
    throw new Error(`${manifest.name} 打包时间不是合法 ISO 时间`);
  if (readFileSync(resolve(root, metadataFiles[1]), 'utf8') !== declaration)
    throw new Error(`${manifest.name} 包版本类型声明已过期`);
}
function generateMetadata({ manifest, root }) {
  const { name, version } = manifest;
  const quote = (value) =>
    JSON.stringify(value)
      .slice(1, -1)
      .replaceAll("'", String.raw`\'`);
  const buildTime = new Date().toISOString();
  writeFileSync(
    resolve(root, metadataFiles[0]),
    `// 由框架包元数据生成脚本生成，记录此包本次构建或打包时间。\nexport const packageVersion = {\n  buildTime: '${buildTime}',\n  name: '${quote(name)}',\n  version: '${quote(version)}',\n};\n`,
  );
  writeFileSync(resolve(root, metadataFiles[1]), declaration);
}
const content = [
  '// 由 scripts/sync-framework-package-metadata.mjs 自动生成；从实际安装包读取普通 JavaScript 版本元数据。',
  ...names.map(
    (name, index) =>
      `import { packageVersion as packageVersion${index} } from '${name}/package-version';`,
  ),
  '',
  'export const frameworkDependencyPackages = [',
  ...names.map((_, index) => `  packageVersion${index},`),
  '];',
  '',
].join('\n');

for (const pkg of trackedPackages) validateExports(pkg);
if (checkOnly) {
  for (const pkg of trackedPackages) await validateMetadata(pkg);
  if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== content)
    throw new Error('框架包元数据导入清单已过期，请运行生成脚本');
} else {
  for (const pkg of trackedPackages) {
    const missing = !metadataFiles.some((file) =>
      existsSync(resolve(pkg.root, file)),
    );
    if (targetRoot ? pkg.root === targetRoot : missing) generateMetadata(pkg);
    // 单包构建不读取或刷新其他包的构建记录；全量检查由 --check 执行。
    if (!targetRoot || pkg.root === targetRoot) await validateMetadata(pkg);
  }
  writeFileSync(outputPath, content);
}
console.log(
  `框架包元数据${checkOnly ? '检查通过' : '已同步'}：${trackedPackages.length} 个发布包`,
);
