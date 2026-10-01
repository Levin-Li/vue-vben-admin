export async function runDependencyLayers(layers, action, concurrency = 2) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('发布并发数必须是正整数');
  }

  // 同层任务互不依赖；一批任务全部结束后才允许启动下一批或下一层。
  for (const layer of layers) {
    for (let index = 0; index < layer.length; index += concurrency) {
      const batch = layer.slice(index, index + concurrency);
      const results = await Promise.allSettled(
        batch.map((item) => action(item)),
      );
      const failure = results.find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;
    }
  }
}

export async function publishValidatedBatch(
  packages,
  layers,
  tarballs,
  { publish, versionStatus, concurrency = 2, log = () => {} },
) {
  const packageByName = new Map(packages.map((item) => [item.name, item]));

  // 上传任何包之前先确认全部候选版本未被占用，避免中途才发现不可覆盖版本。
  for (const packageInfo of packages) {
    if (!tarballs.has(packageInfo.name)) {
      throw new Error(`${packageInfo.name} 缺少已校验的本地 tarball`);
    }
    const status = await versionStatus(packageInfo);
    if (status !== 'absent') {
      throw new Error(
        `${packageInfo.name}@${packageInfo.version} 私服版本${status === 'present' ? '已存在' : '状态不明'}，停止上传`,
      );
    }
  }

  await runDependencyLayers(
    layers,
    async (name) => {
      const packageInfo = packageByName.get(name);
      if (!packageInfo) throw new Error(`未知发布候选包：${name}`);
      const tarball = tarballs.get(name);
      try {
        await publish(packageInfo, tarball);
      } catch (firstError) {
        // 失败或响应丢失时只查询当前包；确认不存在才重试同一制品一次。
        const status = await versionStatus(packageInfo);
        if (status !== 'absent') {
          throw new Error(
            `${name} 上传结果不明且私服版本${status === 'present' ? '已存在' : '无法确认'}，不重发`,
            { cause: firstError },
          );
        }
        await publish(packageInfo, tarball);
      }
      log(`${name}@${packageInfo.version} 发布成功`);
    },
    concurrency,
  );
}
