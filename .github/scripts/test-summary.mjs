#!/usr/bin/env node
/**
 * Renders Jest JSON output as a GitHub job summary.
 *
 * Usage: node test-summary.mjs <unit.json> <e2e.json> [coverage-summary.json]
 *
 * Written against the raw Jest report rather than a marketplace action so the
 * pipeline carries no extra dependency and works the same locally.
 */

import { readFileSync, existsSync } from 'node:fs';
import { appendFileSync } from 'node:fs';

const [unitPath, e2ePath, coveragePath] = process.argv.slice(2);

function readJson(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.warn(`could not parse ${path}: ${error.message}`);
    return null;
  }
}

/** Jest reports per-suite times; the wall clock is the span of the whole run. */
function durationSeconds(report) {
  if (!report?.testResults?.length) return 0;
  const end = Math.max(...report.testResults.map((suite) => suite.endTime ?? 0));
  return (end - report.startTime) / 1000;
}

function row(label, report) {
  if (!report) return `| ${label} | — | — | — | not run |`;
  const icon = report.numFailedTests > 0 ? '❌' : '✅';
  return [
    `| ${icon} ${label}`,
    report.numTotalTests,
    report.numPassedTests,
    report.numFailedTests,
    `${durationSeconds(report).toFixed(1)}s`,
  ].join(' | ') + ' |';
}

function failures(report, label) {
  if (!report?.testResults) return [];

  return report.testResults.flatMap((suite) =>
    (suite.assertionResults ?? [])
      .filter((test) => test.status === 'failed')
      .map((test) => {
        const file = suite.name.replace(`${process.cwd()}/`, '');
        const message = (test.failureMessages?.[0] ?? '')
          // Strip ANSI colours — they render as noise in a summary.
          .replace(/\[[0-9;]*m/g, '')
          .split('\n')
          .slice(0, 12)
          .join('\n');
        return `<details><summary><code>${label}</code> · ${test.fullName}</summary>\n\n\`${file}\`\n\n\`\`\`\n${message}\n\`\`\`\n</details>`;
      }),
  );
}

function suiteBreakdown(report, label) {
  if (!report?.testResults) return [];

  return report.testResults.map((suite) => {
    const file = suite.name.replace(`${process.cwd()}/`, '');
    const tests = suite.assertionResults ?? [];
    const failed = tests.filter((test) => test.status === 'failed').length;
    const icon = failed > 0 ? '❌' : '✅';
    const seconds = (((suite.endTime ?? 0) - (suite.startTime ?? 0)) / 1000).toFixed(2);
    return `| ${icon} | \`${label}\` | \`${file}\` | ${tests.length} | ${failed} | ${seconds}s |`;
  });
}

const unit = readJson(unitPath);
const e2e = readJson(e2ePath);
const coverage = readJson(coveragePath);

const total = {
  tests: (unit?.numTotalTests ?? 0) + (e2e?.numTotalTests ?? 0),
  passed: (unit?.numPassedTests ?? 0) + (e2e?.numPassedTests ?? 0),
  failed: (unit?.numFailedTests ?? 0) + (e2e?.numFailedTests ?? 0),
  seconds: durationSeconds(unit) + durationSeconds(e2e),
};

const lines = [];

lines.push(total.failed > 0 ? '## ❌ Tests failed' : '## ✅ All tests passed');
lines.push('');
lines.push('| Suite | Tests | Passed | Failed | Duration |');
lines.push('| :--- | ---: | ---: | ---: | ---: |');
lines.push(row('Unit', unit));
lines.push(row('End-to-end', e2e));
lines.push(
  `| **Total** | **${total.tests}** | **${total.passed}** | **${total.failed}** | **${total.seconds.toFixed(1)}s** |`,
);
lines.push('');

if (coverage?.total) {
  const { lines: l, statements: s, functions: f, branches: b } = coverage.total;
  lines.push('### Coverage — server');
  lines.push('');
  lines.push('| Lines | Statements | Functions | Branches |');
  lines.push('| ---: | ---: | ---: | ---: |');
  lines.push(`| ${l.pct}% | ${s.pct}% | ${f.pct}% | ${b.pct}% |`);
  lines.push('');
}

const allFailures = [...failures(unit, 'unit'), ...failures(e2e, 'e2e')];
if (allFailures.length > 0) {
  lines.push(`### Failures (${allFailures.length})`);
  lines.push('');
  lines.push(...allFailures);
  lines.push('');
}

const breakdown = [...suiteBreakdown(unit, 'unit'), ...suiteBreakdown(e2e, 'e2e')];
if (breakdown.length > 0) {
  lines.push('<details><summary>Per-suite breakdown</summary>');
  lines.push('');
  lines.push('| | Kind | File | Tests | Failed | Duration |');
  lines.push('| :-- | :-- | :-- | ---: | ---: | ---: |');
  lines.push(...breakdown);
  lines.push('');
  lines.push('</details>');
}

const markdown = lines.join('\n') + '\n';

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
} else {
  process.stdout.write(markdown);
}

// Never fail the pipeline from the reporter — the test steps own that verdict.
process.exit(0);
