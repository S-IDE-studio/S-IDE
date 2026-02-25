import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bodyDir = resolve(__dirname, '../issue-bodies');

// Get GitHub token from gh CLI
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.error('Error: Set GH_TOKEN or GITHUB_TOKEN environment variable');
  process.exit(1);
}

const REPO = 'S-IDE-studio/S-IDE';
const API_URL = `https://api.github.com/repos/${REPO}/issues`;

const issues = [
  {
    title: '[Architecture] ドキュメントの技術スタック記述と実態の不一致 — Core Daemon は Rust ではなく TypeScript/Hono',
    labels: ['architecture', 'documentation', 'P-1:critical'],
    bodyFile: 'issue-01-tech-stack.md',
  },
  {
    title: '[Architecture] モバイル方針の矛盾 — React Native/Expo vs PWA',
    labels: ['architecture', 'documentation', 'P-1:critical'],
    bodyFile: 'issue-02-mobile.md',
  },
  {
    title: '[INV-1/INV-6] CLIコマンド体系の実装 — Headless-First保証',
    labels: ['architecture', 'enhancement', 'P-1:critical'],
    bodyFile: 'issue-03-cli.md',
  },
  {
    title: '[INV-6] ヘルスチェックAPI (/api/health) の実装',
    labels: ['architecture', 'enhancement', 'P-1:critical'],
    bodyFile: 'issue-04-health.md',
  },
  {
    title: '[INV-6/INV-3] Orchestrator・Observer モジュールの実装',
    labels: ['architecture', 'enhancement', 'P-1:critical'],
    bodyFile: 'issue-05-orchestrator-observer.md',
  },
  {
    title: '[INV-5/INV-6] Screen Buffer 抽象化レイヤーの実装',
    labels: ['architecture', 'enhancement', 'P-1:critical'],
    bodyFile: 'issue-06-screen-buffer.md',
  },
  {
    title: '[INV-6/P-2] コスト監視・UsageRecord/ProviderPricing の実装',
    labels: ['architecture', 'enhancement', 'P-2:standard'],
    bodyFile: 'issue-07-cost-monitoring.md',
  },
  {
    title: '[INV-2/INV-6] ミドルウェアチェーン完全化とグレースフルシャットダウン',
    labels: ['architecture', 'enhancement', 'P-1:critical'],
    bodyFile: 'issue-08-middleware-shutdown.md',
  },
];

async function createIssue(issue) {
  const body = readFileSync(resolve(bodyDir, issue.bodyFile), 'utf-8');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title: issue.title,
      body: body,
      labels: issue.labels,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to create "${issue.title}": ${res.status} ${err}`);
    return null;
  }

  const data = await res.json();
  console.log(`Created #${data.number}: ${data.html_url}`);
  return data;
}

async function main() {
  for (const issue of issues) {
    await createIssue(issue);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('Done!');
}

main().catch(console.error);
