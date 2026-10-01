const dependencySections = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
];

function internalDependencies(packageInfo, knownNames) {
  const manifest = packageInfo.packageJson || {};
  return dependencySections.flatMap((section) =>
    Object.keys(manifest[section] || {}).filter((name) => knownNames.has(name)),
  );
}

function isDeliveryPath(path) {
  const normalized = path.replaceAll('\\', '/');
  if (
    /(?:^|\/)(?:__tests__|tests|dist|node_modules|project-reference)(?:\/|$)/.test(
      normalized,
    )
  ) {
    return false;
  }
  return !/(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/.test(normalized);
}

export function collectChangedPackages(packages, changedPaths) {
  const selected = new Set();

  // 只把可发布包内的交付文件归属到最近的包目录；测试和构建产物不触发升版。
  for (const changedPath of changedPaths) {
    const normalized = changedPath.replaceAll('\\', '/');
    if (!isDeliveryPath(normalized)) continue;
    const owner = packages
      .filter(({ path }) => normalized.startsWith(`${path}/`))
      .toSorted((left, right) => right.path.length - left.path.length)[0];
    if (owner) selected.add(owner.name);
  }

  return packages
    .filter(({ name }) => selected.has(name))
    .map(({ name }) => name);
}

export function expandExactConsumerClosure(packages, seedNames) {
  const knownNames = new Set(packages.map(({ name }) => name));
  const selected = new Set(seedNames);
  for (const name of selected) {
    if (!knownNames.has(name)) throw new Error(`未知可发布包：${name}`);
  }

  // 精确内部版本变化会改变消费者的 tarball 元数据，持续扩展直到闭包稳定。
  let changed = true;
  while (changed) {
    changed = false;
    for (const packageInfo of packages) {
      if (selected.has(packageInfo.name)) continue;
      if (
        internalDependencies(packageInfo, knownNames).some((name) =>
          selected.has(name),
        )
      ) {
        selected.add(packageInfo.name);
        changed = true;
      }
    }
  }

  return packages
    .filter(({ name }) => selected.has(name))
    .map(({ name }) => name);
}

export function topologicalLayers(packages, selectedNames) {
  const selected = new Set(selectedNames);
  const knownNames = new Set(packages.map(({ name }) => name));
  const pending = new Set(selectedNames);
  const layers = [];

  // 每一层只包含内部上游已完成的节点，层内节点可以并行执行。
  while (pending.size > 0) {
    const ready = packages
      .filter(({ name }) => pending.has(name))
      .filter((packageInfo) =>
        internalDependencies(packageInfo, knownNames).every(
          (name) => !selected.has(name) || !pending.has(name),
        ),
      )
      .map(({ name }) => name);
    if (ready.length === 0) {
      throw new Error(`发布包内部依赖存在循环：${[...pending].join(', ')}`);
    }
    layers.push(ready);
    for (const name of ready) pending.delete(name);
  }

  return layers;
}

function parseVersion(version, name) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || ''));
  if (!match) throw new Error(`${name} 缺少稳定的 x.y.z 版本`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right, name) {
  const leftParts = parseVersion(left, name);
  const rightParts = parseVersion(right, name);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

export function preparePackageVersions(
  currentConfig,
  baselineConfig,
  selectedNames,
) {
  const next = {
    ...currentConfig,
    packages: { ...currentConfig.packages },
  };

  // 已准备但尚未发布的候选版本保持不变，避免失败重试时再次递增。
  for (const name of selectedNames) {
    const current = next.packages[name];
    const baseline =
      baselineConfig.packages?.[name] || baselineConfig.releaseVersion;
    if (compareVersions(current, baseline, name) < 0) {
      throw new Error(`${name} 当前版本低于上次基线：${current} < ${baseline}`);
    }
    if (current === baseline) {
      const [major, minor, patch] = parseVersion(current, name);
      next.packages[name] = `${major}.${minor}.${patch + 1}`;
    }
  }

  return next;
}
