import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adminModulePackages = [
  'packages/business/admin-framework',
  'packages/business/oak-base-admin',
];
const ruleFiles = [
  'AGENTS.md',
  '前端项目开发规则.md',
  '前端页面开发规则.md',
  '前端API开发规则.md',
  '前端页面操作规则.md',
  '前端页面校验规则.md',
  '前端页面上传规则.md',
  '前端部署代理规则.md',
];

const args = new Set(process.argv.slice(2));
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

function writePackageAgents(packageRoot, packageName) {
  const content = `# Published Package AGENTS.md

<INSTRUCTIONS>
本文件随 ${packageName} npm 发布包分发，作为第三方项目和 AI 辅助工具读取包内规则的一等入口。

处理本包源码、构建产物、示例、页面、组件、API 或文档时，应先读取并遵循 \`docs/frontend-rules/\` 下随包发布的前端规则文档。

必读入口：

- \`docs/frontend-rules/前端项目开发规则.md\`
- \`docs/frontend-rules/前端页面开发规则.md\`
- \`docs/frontend-rules/前端API开发规则.md\`
- \`docs/frontend-rules/前端页面操作规则.md\`
- \`docs/frontend-rules/前端页面校验规则.md\`
- \`docs/frontend-rules/前端页面上传规则.md\`
- \`docs/frontend-rules/前端部署代理规则.md\`

如果本包被放回源码仓库中开发，源码仓库中更靠近目标文件的 AGENTS.md 和规则文件优先于本发布包入口。
</INSTRUCTIONS>
`;

  writeFileSync(resolve(packageRoot, 'AGENTS.md'), content);
}

for (const packageRoot of packageRoots) {
  const packageName = readPackageName(packageRoot);
  const targetRuleDir = resolve(packageRoot, 'docs/frontend-rules');

  rmSync(targetRuleDir, { force: true, recursive: true });
  mkdirSync(targetRuleDir, { recursive: true });

  for (const ruleFile of ruleFiles) {
    copyFileSync(
      resolve(frontendRoot, ruleFile),
      resolve(targetRuleDir, basename(ruleFile)),
    );
  }

  writePackageAgents(packageRoot, packageName);
  console.log(`Synced frontend rule docs for ${packageName}`);
}
