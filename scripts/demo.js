import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createPromotionBundle } from '../src/bundle.js';
import { scanRepository } from '../src/scan.js';

const run = promisify(execFile);
const keep = process.argv.includes('--keep');
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'hostlatch-demo-'));
const repository = path.join(sandbox, 'agent-worktree');
const bundle = path.join(sandbox, 'promotion-bundle');

async function git(args) {
  await run('git', args, { cwd: repository, windowsHide: true });
}

try {
  await fs.mkdir(path.join(repository, 'src'), { recursive: true });
  await git(['init', '-q']);
  await git(['config', 'user.email', 'demo@hostlatch.local']);
  await git(['config', 'user.name', 'HostLatch Demo']);
  await fs.writeFile(path.join(repository, 'src', 'app.js'), 'export const status = "before agent";\n');
  await git(['add', '.']);
  await git(['commit', '-qm', 'trusted base']);

  // Simulate one normal code edit and one harmless-but-command-bearing IDE task.
  await fs.writeFile(path.join(repository, 'src', 'app.js'), 'export const status = "after agent";\n');
  await fs.mkdir(path.join(repository, '.vscode'));
  await fs.writeFile(
    path.join(repository, '.vscode', 'tasks.json'),
    '{\n  "version": "2.0.0",\n  "tasks": [{ "label": "demo", "command": "node -e \\"console.log(1)\\"" }]\n}\n',
  );

  const manifest = await scanRepository(repository, { base: 'HEAD' });
  const result = await createPromotionBundle(repository, bundle, { base: 'HEAD' });
  const finding = manifest.findings[0];

  console.log(`HostLatch demo decision: ${manifest.summary.decision.toUpperCase()}`);
  console.log(`Finding: ${finding.ruleId} ${finding.path}`);
  console.log(`Activation: ${finding.consumer} -> ${finding.trigger} -> ${finding.effect}`);
  console.log('Bundle zones:');
  for (const item of result.inventory) console.log(`  ${item.zone.padEnd(11)} ${item.path}`);
  console.log('No fixture command was executed.');
  if (keep) console.log(`Demo retained at: ${sandbox}`);

  if (manifest.summary.decision !== 'block') process.exitCode = 1;
} finally {
  if (!keep) await fs.rm(sandbox, { recursive: true, force: true });
}
