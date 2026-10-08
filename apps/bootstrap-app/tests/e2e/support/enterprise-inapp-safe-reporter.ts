import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

// 中止矩阵仍保留断言位置；默认不写可能包含凭据的错误原文或调用栈。
export default class EnterpriseSafeReporter implements Reporter {
  private readonly counts: Record<string, number> = {};
  private runnerErrorCount = 0;
  onEnd(result: FullResult): void {
    process.stdout.write(
      `${JSON.stringify({ status: result.status, counts: this.counts, runnerErrorCount: this.runnerErrorCount })}\n`,
    );
  }
  onError(): void {
    // 全局环境或加载错误也记录失败，不输出可能带授权值的异常原文。
    this.runnerErrorCount += 1;
  }
  onTestEnd(test: TestCase, result: TestResult): void {
    this.counts[result.status] = (this.counts[result.status] || 0) + 1;
    process.stdout.write(
      `${result.status}: ${test.titlePath().join(' / ')} (${result.duration}ms)\n`,
    );
    const directory = join(
      process.env.ENTERPRISE_EVIDENCE_DIR || '/tmp/enterprise-inapp-browser',
      'completed-cases',
    );
    mkdirSync(directory, { recursive: true });
    const filename = test
      .titlePath()
      .join('-')
      .replaceAll(/[^\w\u4E00-\u9FA5-]/g, '-');
    writeFileSync(
      join(directory, `${filename}.json`),
      JSON.stringify(
        {
          title: test.title,
          status: result.status,
          duration: result.duration,
          errorCount: result.errors.length,
          location: test.location,
        },
        null,
        2,
      ),
    );
  }
}
