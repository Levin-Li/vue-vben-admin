import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// 逐个对照前端服务与本仓库控制器，避免显示名称被误用为权限资源类型。
const frontendRoot = resolve(import.meta.dirname, '..');
const projectRoot = resolve(frontendRoot, '../..');
const controllerRoots = ['admin-api', 'web-commons', 'client-api'].map(
  (module) => join(projectRoot, module, 'src/main/java'),
);
const entityRoot = join(
  projectRoot,
  'entities/src/main/java/com/levin/oak/base/entities',
);
const categoryNames = {
  BIZ: '业务数据',
  COMMON: '通用数据',
  EXPERT: '专家数据',
  PLATFORM: '平台数据',
  SYS: '系统数据',
};

// 仅遍历源码服务文件，不读取依赖目录和构建产物。
function serviceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === 'dist') return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return serviceFiles(path);
    return entry.name.endsWith('-service.ts') ? [path] : [];
  });
}

function readStringProperty(source, property) {
  return source.match(
    new RegExp(String.raw`\b${property}:\s*['"]([^'"]+)['"]`),
  )?.[1];
}

function resolveTagName(controller) {
  const tag = controller.match(
    /@Tag\(name\s*=\s*(?:E_(\w+)\.BIZ_NAME|"([^"]+)")/,
  );
  if (!tag) return null;
  if (tag[2]) return tag[2];
  const entityFile = join(entityRoot, `${tag[1]}.java`);
  if (!existsSync(entityFile)) return null;
  return (
    readFileSync(entityFile, 'utf8').match(
      /@Schema\(title\s*=\s*"([^"]+)"/,
    )?.[1] ?? null
  );
}

function resolveType(expression, tagName) {
  const literal = expression.match(/^"([^"]+)"$/);
  if (literal) {
    return literal[1].endsWith('-')
      ? `${literal[1]}${tagName ?? ''}`
      : literal[1];
  }
  const constant = expression.match(
    /^(?:EntityConst\.|EntityOpConst\.)?(\w+)_TYPE_NAME(?:\s*\+\s*"([^"]*)")?$/,
  );
  if (!constant || !categoryNames[constant[1]]) return null;
  const type = categoryNames[constant[1]] + (constant[2] ?? '');
  return type.endsWith('-') ? `${type}${tagName ?? ''}` : type;
}

const errors = [];
let checked = 0;
let skipped = 0;

for (const file of serviceFiles(join(frontendRoot, 'packages'))) {
  const source = readFileSync(file, 'utf8');
  const service = source.match(/@Service\(\{([\s\S]*?)\}\)/)?.[1];
  if (!service) continue;
  const controllerClass = readStringProperty(service, 'controllerClass');
  const frontendType = readStringProperty(service, 'type');
  if (!controllerClass || !frontendType) {
    skipped += 1;
    continue;
  }

  const relativeController = `${controllerClass.replaceAll('.', '/')}.java`;
  const controllerFile = controllerRoots
    .map((root) => join(root, relativeController))
    .find((path) => existsSync(path));
  if (!controllerFile) {
    skipped += 1;
    continue;
  }

  const controller = readFileSync(controllerFile, 'utf8');
  const classHeader = controller
    .split(/\bpublic\s+(?:abstract\s+)?class\b/)[0]
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const classAuthorize = [
    ...classHeader.matchAll(/@ResAuthorize\(([^)]*)\)/g),
  ].at(-1)?.[1];
  const classType = classAuthorize
    ?.match(/\btype\s*=\s*([^,\n]+)/)?.[1]
    ?.trim();
  if (!classType) {
    skipped += 1;
    continue;
  }

  const tagName = resolveTagName(classHeader);
  const expectedType = resolveType(classType, tagName);
  if (!expectedType) {
    errors.push(`${file}: 无法解析 ${controllerClass} 的权限资源类型`);
    continue;
  }

  checked += 1;
  if (frontendType !== expectedType) {
    errors.push(
      `${file}: @Service.type 为 ${frontendType}，${controllerClass} 要求 ${expectedType}`,
    );
  }

  // 方法级声明可覆盖控制器类型；仅接受控制器源码中实际声明的覆盖类型。
  const allowedMethodTypes = new Set([expectedType]);
  for (const annotation of controller.matchAll(/@ResAuthorize\(([^)]*)\)/g)) {
    const expression = annotation[1]
      .match(/\btype\s*=\s*([^,\n]+)/)?.[1]
      ?.trim();
    if (!expression) continue;
    const resolved = resolveType(expression, tagName);
    if (resolved) allowedMethodTypes.add(resolved);
  }

  for (const annotation of source.matchAll(/@ResAuthorize\(\{([^}]*)\}\)/g)) {
    const methodType = readStringProperty(annotation[1], 'type');
    if (methodType && !allowedMethodTypes.has(methodType)) {
      errors.push(
        `${file}: 方法资源类型 ${methodType} 未见于 ${controllerClass}`,
      );
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `前端 API 资源类型与控制器一致：核对 ${checked} 个服务，跳过 ${skipped} 个无本仓库可解析类级权限的服务\n`,
  );
}
