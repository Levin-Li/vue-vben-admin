import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const business = path.join(root, 'packages/business');
const target = path.join(
  root,
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/agent-api-candidates.json',
);

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '__tests__'
    )
      continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(file)));
    else if (
      entry.isFile() &&
      !/\.d\.[cm]?[jt]sx?$/.test(entry.name) &&
      !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name) &&
      /\.[cm]?[jt]sx?$/.test(entry.name) &&
      (/-service\.[cm]?[jt]sx?$/.test(entry.name) ||
        file.includes(`${path.sep}api${path.sep}`))
    )
      files.push(file);
  }
  return files;
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function isPublicCallable(member) {
  const callable =
    ts.isMethodDeclaration(member) ||
    (ts.isPropertyDeclaration(member) &&
      member.initializer &&
      (ts.isArrowFunction(member.initializer) ||
        ts.isFunctionExpression(member.initializer)));
  return Boolean(
    callable &&
    member.name &&
    !ts.isPrivateIdentifier(member.name) &&
    !hasModifier(member, ts.SyntaxKind.PrivateKeyword) &&
    !hasModifier(member, ts.SyntaxKind.ProtectedKeyword),
  );
}

function decoratorString(node, decoratorName, property) {
  const decorators = ts.canHaveDecorators(node)
    ? (ts.getDecorators(node) ?? [])
    : [];
  for (const decorator of decorators) {
    const expression = decorator.expression;
    if (
      !ts.isCallExpression(expression) ||
      !ts.isIdentifier(expression.expression) ||
      expression.expression.text !== decoratorName
    )
      continue;
    const argument = expression.arguments[0];
    if (!argument || !ts.isObjectLiteralExpression(argument)) continue;
    for (const item of argument.properties) {
      if (
        ts.isPropertyAssignment(item) &&
        item.name.getText() === property &&
        ts.isStringLiteral(item.initializer)
      )
        return item.initializer.text;
    }
  }
  return null;
}

function candidate(
  file,
  owner,
  node,
  source,
  title = null,
  controllerClass = null,
) {
  const name =
    node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
      ? node.name.text
      : null;
  const dynamic = !name;
  return {
    file,
    owner,
    title,
    controllerClass,
    method: name,
    action: decoratorString(node, 'ResAuthorize', 'action'),
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    parameters: (node.parameters ?? node.initializer?.parameters ?? []).map(
      (parameter) => ({
        name: ts.isIdentifier(parameter.name) ? parameter.name.text : null,
        type: parameter.type?.getText(source) ?? null,
        optional: Boolean(parameter.questionToken || parameter.initializer),
      }),
    ),
    permissionMetadata: (ts.canHaveDecorators(node)
      ? (ts.getDecorators(node) ?? [])
      : []
    ).some((decorator) =>
      /^@ResAuthorize\s*\(/.test(decorator.getText(source)),
    ),
    dynamic,
    executable: false,
  };
}

export async function scanAgentApiCandidates(options = {}) {
  const repoRoot = options.repoRoot ?? root;
  const scanRoot = options.businessRoot ?? business;
  const discoveredFiles = await filesIn(scanRoot);
  const files = discoveredFiles.toSorted();
  const candidates = [];
  const unresolved = [];
  const classes = new Map();
  for (const file of files) {
    const relative = path.relative(repoRoot, file).split(path.sep).join('/');
    const ext = path.extname(file).toLowerCase();
    const kinds = {
      '.tsx': ts.ScriptKind.TSX,
      '.jsx': ts.ScriptKind.JSX,
      '.js': ts.ScriptKind.JS,
      '.mjs': ts.ScriptKind.JS,
      '.cjs': ts.ScriptKind.JS,
    };
    const kind = kinds[ext] ?? ts.ScriptKind.TS;
    const source = ts.createSourceFile(
      relative,
      await readFile(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      kind,
    );
    if (source.parseDiagnostics.length > 0)
      throw new Error(`无法解析 ${relative}`);
    for (const node of source.statements) {
      if (ts.isClassDeclaration(node) && node.name) {
        if (classes.has(node.name.text)) {
          throw new Error(
            `服务类名称重复，无法安全解析继承：${node.name.text}`,
          );
        }
        classes.set(node.name.text, { file: relative, node, source });
        for (const member of node.members) {
          if (isPublicCallable(member)) {
            candidates.push(
              candidate(
                relative,
                node.name.text,
                member,
                source,
                decoratorString(node, 'Service', 'title'),
                decoratorString(node, 'Service', 'controllerClass'),
              ),
            );
          }
        }
      } else if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        hasModifier(node, ts.SyntaxKind.ExportKeyword)
      ) {
        candidates.push(candidate(relative, null, node, source));
      } else if (
        ts.isVariableStatement(node) &&
        hasModifier(node, ts.SyntaxKind.ExportKeyword)
      ) {
        for (const declaration of node.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer)
            continue;
          const owner = declaration.name.text;
          if (ts.isObjectLiteralExpression(declaration.initializer)) {
            for (const member of declaration.initializer.properties) {
              if (
                ts.isMethodDeclaration(member) ||
                (ts.isPropertyAssignment(member) &&
                  (ts.isArrowFunction(member.initializer) ||
                    ts.isFunctionExpression(member.initializer)))
              ) {
                candidates.push(candidate(relative, owner, member, source));
              } else if (
                ts.isSpreadAssignment(member) ||
                (ts.isPropertyAssignment(member) &&
                  ts.isComputedPropertyName(member.name))
              ) {
                unresolved.push({
                  file: relative,
                  owner,
                  reason: '动态对象属性需要人工核查',
                });
              }
            }
          } else if (
            ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer)
          ) {
            candidates.push(candidate(relative, null, declaration, source));
          } else if (ts.isCallExpression(declaration.initializer)) {
            unresolved.push({
              file: relative,
              owner,
              reason: '导出值由函数动态创建，需要人工核查',
            });
          }
        }
      }
    }
  }
  for (const { file, node } of classes.values()) {
    const owner = node.name.text;
    const declared = new Set(
      candidates
        .filter((entry) => entry.file === file && entry.owner === owner)
        .map((entry) => entry.method),
    );
    const seen = new Set([owner]);
    let current = node;
    while (current.heritageClauses?.length) {
      const parent = current.heritageClauses.flatMap((clause) => [
        ...clause.types,
      ])[0];
      if (!parent || !ts.isIdentifier(parent.expression)) {
        unresolved.push({ file, owner, reason: '动态基类需要人工核查' });
        break;
      }
      const parentName = parent.expression.text;
      if (parentName === 'RequestService' || parentName === 'Object') break;
      if (seen.has(parentName) || !classes.has(parentName)) {
        unresolved.push({
          file,
          owner,
          reason: `基类 ${parentName} 无法静态解析`,
        });
        break;
      }
      seen.add(parentName);
      const base = classes.get(parentName);
      for (const member of base.node.members) {
        if (!isPublicCallable(member)) continue;
        const item = candidate(base.file, parentName, member, base.source);
        if (declared.has(item.method)) continue;
        candidates.push({
          ...item,
          file,
          owner,
          title: decoratorString(node, 'Service', 'title'),
          controllerClass: decoratorString(node, 'Service', 'controllerClass'),
          inheritedFrom: parentName,
          declarationFile: base.file,
        });
        declared.add(item.method);
      }
      current = base.node;
    }
  }
  return {
    version: 1,
    files: files.map((file) =>
      path.relative(repoRoot, file).split(path.sep).join('/'),
    ),
    candidates,
    unresolved,
  };
}

// 固定绑定原始服务实例，模型不能指定模块路径。
async function generateBusinessServiceBindings(result) {
  const eligible = result.candidates.filter((entry) => entry.controllerClass && entry.permissionMetadata &&
    entry.file.startsWith('packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/'));
  const bindings = [];
  for (const file of [...new Set(eligible.map((entry) => entry.file))].sort()) {
    const source = ts.createSourceFile(file, await readFile(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const node of source.statements) {
      if (!ts.isVariableStatement(node) || !hasModifier(node, ts.SyntaxKind.ExportKeyword)) continue;
      for (const declaration of node.declarationList.declarations) {
        const initial = declaration.initializer;
        if (!ts.isIdentifier(declaration.name) || !initial || !ts.isNewExpression(initial) || !ts.isIdentifier(initial.expression)) continue;
        const owner = initial.expression.text;
        if (eligible.some((entry) => entry.file === file && entry.owner === owner))
          bindings.push({ owner, name: declaration.name.text, file: path.basename(file, '.ts') });
      }
    }
  }
  const imports = bindings.map((item, index) => `import { ${item.name} as service${index} } from './${item.file}';`).join('\n');
  const entries = bindings.map((item, index) => `  ${JSON.stringify(item.owner)}: service${index},`).join('\n');
  return `// 自动生成：node scripts/scan-agent-api-candidates.mjs\n${imports}\n\nexport const generatedAgentServices: Record<string, object> = {\n${entries}\n};\n`;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await scanAgentApiCandidates();
  const output = `${JSON.stringify(result, null, 2)}\n`;
  const serviceTarget = path.join(path.dirname(target), 'generated-agent-services.ts');
  const serviceBindings = await generateBusinessServiceBindings(result);
  if (process.argv.includes('--check')) {
    const existing = await readFile(target, 'utf8').catch(() => '');
    if (existing !== output || await readFile(serviceTarget, 'utf8').catch(() => '') !== serviceBindings)
      throw new Error('AI 接口候选目录或服务绑定已过期，请重新运行扫描');
  } else { await writeFile(target, output); await writeFile(serviceTarget, serviceBindings); }
  process.stdout.write(
    `已扫描 ${result.files.length} 个源文件、${result.candidates.length} 个方法；业务服务绑定已生成，${result.unresolved.length} 个动态或继承项待核查。\n`,
  );
}
