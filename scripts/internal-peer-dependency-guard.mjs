const INTERNAL_PACKAGE_PATTERN = /^@(levin|vben|vben-core)\//;

export function validateInternalPeerVersions(
  packageInfo,
  selectedPackageVersionByName,
  versionConfig,
) {
  const peerDependencies = packageInfo.packageJson.peerDependencies || {};
  const mismatches = [];

  for (const [dependencyName, declaredVersion] of Object.entries(
    peerDependencies,
  )) {
    if (!INTERNAL_PACKAGE_PATTERN.test(dependencyName)) {
      continue;
    }

    const expectedVersion =
      selectedPackageVersionByName.get(dependencyName) ||
      versionConfig.packages?.[dependencyName] ||
      versionConfig.default;

    if (!expectedVersion) {
      mismatches.push(`${dependencyName}: ${declaredVersion} -> <未配置版本>`);
      continue;
    }

    if (declaredVersion !== expectedVersion) {
      mismatches.push(
        `${dependencyName}: ${declaredVersion} -> ${expectedVersion}`,
      );
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `${packageInfo.name} 的内部 peerDependencies 未精确跟随当前内部发布版本：\n${mismatches
        .map((item) => `- ${item}`)
        .join(
          '\n',
        )}\n请先更新 package-versions.json 并运行 pnpm run sync:package-versions。`,
    );
  }
}
