#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const excludedDirs = new Set([
  '.git',
  '.nuxt',
  '.output',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
]);

function walkVueFiles(targetPath, files = []) {
  const stat = statSync(targetPath);

  if (stat.isFile()) {
    if (extname(targetPath) === '.vue') {
      files.push(targetPath);
    }
    return files;
  }

  if (!stat.isDirectory()) {
    return files;
  }

  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) {
        walkVueFiles(join(targetPath, entry.name), files);
      }
      continue;
    }

    if (entry.isFile() && extname(entry.name) === '.vue') {
      files.push(join(targetPath, entry.name));
    }
  }

  return files;
}

function extractTagName(openTag) {
  const match = openTag.match(/^<\/?\s*([a-z][\w.-]*)/i);
  return match?.[1] ?? '';
}

function extractRootTags(content) {
  const tags = [];
  const tagPattern = /<!--[\s\S]*?-->|<\/?[a-z][\w.-]*(?:\s[^<>]*)?>/gi;
  let depth = 0;

  for (let match = tagPattern.exec(content); match; ) {
    const token = match[0];
    if (token.startsWith('<!--')) {
      match = tagPattern.exec(content);
      continue;
    }

    const tagName = extractTagName(token);
    if (!tagName) {
      match = tagPattern.exec(content);
      continue;
    }

    const isClosingTag = token.startsWith('</');
    const isSelfClosing = token.endsWith('/>') || token.startsWith('<!');

    if (!isClosingTag && depth === 0) {
      tags.push({
        index: match.index,
        name: tagName,
        token,
      });
    }

    if (!isClosingTag && !isSelfClosing) {
      depth += 1;
    } else if (isClosingTag) {
      depth = Math.max(0, depth - 1);
    }

    match = tagPattern.exec(content);
  }

  return tags;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function getTemplateBlocks(content) {
  const blocks = [];
  const pattern = /<template(?:\s[^>]*)?>([\s\S]*?)<\/template>/g;

  for (let match = pattern.exec(content); match; ) {
    blocks.push({
      content: match[1],
      offset: match.index + match[0].indexOf(match[1]),
    });
    match = pattern.exec(content);
  }

  return blocks;
}

function hasRouteViewSlot(template) {
  return (
    /<RouterView[^>]*v-slot=/.test(template) ||
    /<router-view[^>]*v-slot=/.test(template)
  );
}

function hasRouteComponentBinding(tagToken) {
  return /:is\s*=\s*["'](?:Component|transformComponent\s*\(\s*Component\b)/.test(
    tagToken,
  );
}

function checkVueFile(file) {
  const content = readFileSync(file, 'utf8');
  const problems = [];

  for (const block of getTemplateBlocks(content)) {
    if (!hasRouteViewSlot(block.content)) {
      continue;
    }

    const transitionPattern = /<Transition\b[^>]*>([\s\S]*?)<\/Transition>/g;

    for (
      let transitionMatch = transitionPattern.exec(block.content);
      transitionMatch;
    ) {
      const transitionBody = transitionMatch[1];
      const roots = extractRootTags(transitionBody);
      const firstRoot = roots[0];

      if (!firstRoot) {
        continue;
      }

      const rootName = firstRoot.name.toLowerCase();
      const isRiskyRoot =
        rootName === 'keepalive' ||
        (rootName === 'component' && hasRouteComponentBinding(firstRoot.token));

      if (isRiskyRoot) {
        problems.push({
          line: getLineNumber(
            content,
            block.offset +
              transitionMatch.index +
              transitionMatch[0].indexOf(firstRoot.token),
          ),
          root: firstRoot.name,
        });
      }

      transitionMatch = transitionPattern.exec(block.content);
    }
  }

  return problems;
}

function normalizeTargetPaths(args) {
  const paths = args.filter((arg) => !arg.startsWith('-'));

  return (paths.length > 0 ? paths : [process.cwd()])
    .map((target) => resolve(process.cwd(), target))
    .filter((target) => {
      if (existsSync(target)) {
        return true;
      }
      console.error(`Route transition guard target not found: ${target}`);
      return false;
    });
}

const targetPaths = normalizeTargetPaths(process.argv.slice(2));

if (targetPaths.length === 0) {
  process.exit(1);
}

const scanRoot = targetPaths.length === 1 ? targetPaths[0] : process.cwd();
const problems = [];

for (const targetPath of targetPaths) {
  for (const file of walkVueFiles(targetPath)) {
    const fileProblems = checkVueFile(file);
    for (const problem of fileProblems) {
      problems.push({
        ...problem,
        file: relative(scanRoot, file).split(sep).join('/'),
      });
    }
  }
}

if (problems.length > 0) {
  console.error(
    'Route transition guard failed. RouterView + Transition must wrap route components in a stable single DOM root before KeepAlive/component.',
  );
  for (const problem of problems) {
    console.error(
      `- ${problem.file}:${problem.line} Transition direct child is <${problem.root}>`,
    );
  }
  process.exit(1);
}

process.stdout.write('Route transition guard passed.\n');
