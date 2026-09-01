import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(frontendRoot, '..', '..');
const moduleStandardSourcePath = resolve(
  projectRoot,
  'docs/release/MODULE-DEVELOPMENT-STANDARD.md',
);
const adminModulePackages = [
  'packages/business/admin-framework',
  'packages/business/oak-base-admin',
];
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const packageRoots = args.has('--all')
  ? adminModulePackages.map((packagePath) => resolve(frontendRoot, packagePath))
  : [process.cwd()];

function readPackageName(packageRoot) {
  const packageJsonPath = resolve(packageRoot, 'package.json');

  if (!existsSync(packageJsonPath)) {
    throw new Error(`package.json not found: ${packageJsonPath}`);
  }

  return JSON.parse(readFileSync(packageJsonPath, 'utf8')).name;
}

function writeOrCheckFile(filePath, content) {
  if (checkOnly) {
    if (!existsSync(filePath) || readFileSync(filePath, 'utf8') !== content) {
      throw new Error(`发布包模块使用规范未同步: ${filePath}`);
    }
    return;
  }

  writeFileSync(filePath, content);
}

function writePackageAgents(packageRoot, packageName) {
  const content = `# Published Package AGENTS.md

<INSTRUCTIONS>
本文件随 ${packageName} npm 发布包分发，作为第三方项目和 AI 辅助工具读取模块使用规范的一等入口。

使用本包进行二次开发、扩展、配置、升级或发布的子项目，必须先读取并遵循 \`docs/MODULE-DEVELOPMENT-STANDARD.md\`。该规范约束公开入口、兼容扩展、安全、测试和升级，不要求子项目采用本包发布方的代码包名、源码目录或业务实现。

必读入口：

- \`docs/MODULE-DEVELOPMENT-STANDARD.md\`

本文件和模块使用规范均由发布流程生成或同步；源码仓中的项目专用规则不构成下游子项目的强制要求。
</INSTRUCTIONS>
`;

  writeOrCheckFile(resolve(packageRoot, 'AGENTS.md'), content);
}

function verifyPackageReadme(packageRoot) {
  const readmePath = resolve(packageRoot, 'README.md');
  const requiredReference = 'docs/MODULE-DEVELOPMENT-STANDARD.md';

  if (
    !existsSync(readmePath) ||
    !readFileSync(readmePath, 'utf8').includes(requiredReference)
  ) {
    throw new Error(`发布包 README 未声明模块使用规范: ${readmePath}`);
  }
}

for (const packageRoot of packageRoots) {
  const packageName = readPackageName(packageRoot);
  const targetDocsDir = resolve(packageRoot, 'docs');
  const legacyRuleDir = resolve(targetDocsDir, 'frontend-rules');
  const targetStandardPath = resolve(
    targetDocsDir,
    'MODULE-DEVELOPMENT-STANDARD.md',
  );

  if (!checkOnly) {
    rmSync(legacyRuleDir, { force: true, recursive: true });
    mkdirSync(targetDocsDir, { recursive: true });
    copyFileSync(moduleStandardSourcePath, targetStandardPath);
  } else if (
    existsSync(legacyRuleDir) ||
    !existsSync(targetStandardPath) ||
    readFileSync(targetStandardPath, 'utf8') !==
      readFileSync(moduleStandardSourcePath, 'utf8')
  ) {
    throw new Error(`发布包模块使用规范未同步: ${packageRoot}`);
  }

  writePackageAgents(packageRoot, packageName);
  verifyPackageReadme(packageRoot);
  console.log(
    `${checkOnly ? 'Checked' : 'Synced'} module development standard for ${packageName}`,
  );
}
