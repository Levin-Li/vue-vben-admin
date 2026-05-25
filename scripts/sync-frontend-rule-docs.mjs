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
  '前端页面开发规则.md',
  '前端API开发规则.md',
  '前端页面操作规则.md',
  '前端页面校验规则.md',
  '前端页面上传规则.md',
  '前端部署代理规则.md',
];

const args = new Set(process.argv.slice(2));
const includeProjectRule =
  args.has('--include-project-rule') ||
  process.env.FRONTEND_RULES_INCLUDE_PROJECT_RULE === 'true' ||
  process.env.FRONTEND_RULES_INCLUDE_PROJECT_RULE === '1';
const packageRoots = args.has('--all')
  ? adminModulePackages.map((packagePath) => resolve(frontendRoot, packagePath))
  : [process.cwd()];
const effectiveRuleFiles = includeProjectRule
  ? ['前端项目开发规则.md', ...ruleFiles]
  : ruleFiles;

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

${includeProjectRule ? '- `docs/frontend-rules/前端项目开发规则.md`\n' : ''}- \`docs/frontend-rules/前端页面开发规则.md\`
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

function writeRuleDocsAgents(packageRoot) {
  const content = `# Published Frontend Rules AGENTS.md

<INSTRUCTIONS>
本文件适用于随包发布的 \`docs/frontend-rules/\` 目录。源码工作区不固定保存前端项目规则副本;打包和发布流程会按需临时写入 \`前端项目开发规则.md\`，并在结束后清理。

## 必读规则

按任务类型读取对应专项规则:

${includeProjectRule ? '- 前端项目总规则、浏览器验证、打包和发布规则: `前端项目开发规则.md`\n' : ''}- 页面开发、布局、组件、主题和CRUD页面: \`前端页面开发规则.md\`
- API封装、接口请求、服务层调用和后端接口对接: \`前端API开发规则.md\`
- 页面操作、按钮、动作归属和交互流程: \`前端页面操作规则.md\`
- 表单校验、字段校验和提交前校验: \`前端页面校验规则.md\`
- 上传组件、文件选择和资源上传: \`前端页面上传规则.md\`
- 部署代理、开发代理和接口转发: \`前端部署代理规则.md\`

## 执行要求

- 涉及多个主题时必须同时读取对应专项规则。
- 页面视觉、交互、路由、下载和浏览器现场问题优先用当前 in-app browser 验证；如果 in-app browser 不可用，可使用补充验证，但必须明确标注不能代表用户当前浏览器现场。
</INSTRUCTIONS>
`;

  writeFileSync(resolve(packageRoot, 'docs/frontend-rules/AGENTS.md'), content);
}

for (const packageRoot of packageRoots) {
  const packageName = readPackageName(packageRoot);
  const targetRuleDir = resolve(packageRoot, 'docs/frontend-rules');

  rmSync(targetRuleDir, { force: true, recursive: true });
  mkdirSync(targetRuleDir, { recursive: true });

  for (const ruleFile of effectiveRuleFiles) {
    copyFileSync(
      resolve(frontendRoot, ruleFile),
      resolve(targetRuleDir, basename(ruleFile)),
    );
  }

  writePackageAgents(packageRoot, packageName);
  writeRuleDocsAgents(packageRoot);
  console.log(`Synced frontend rule docs for ${packageName}`);
}
