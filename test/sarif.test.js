import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { toSarif } from '../src/sarif.js';
import { analyzeChanges } from '../src/scan.js';

const metadata = {
  root: 'C:\\private\\workspace',
  repository: 'repository',
  branch: 'feature/sarif',
  baseRef: 'main',
  baseCommit: 'abc',
  headCommit: 'def',
  dirty: false,
};

function change(path, content) {
  return {
    status: 'A',
    path,
    content,
    baseContent: '',
    contentHash: 'current',
    baseContentHash: null,
    mode: '100644',
    oldMode: null,
    truncated: false,
    isSymlink: false,
    symlinkTarget: null,
  };
}

test('SARIF export maps HostLatch findings without leaking local paths', () => {
  const manifest = analyzeChanges([
    change('folder with spaces/.vscode/tasks.json', '{"tasks":[{"command":"node payload.js"}]}'),
    change('apps/web/package.json', '{"scripts":{"postinstall":"node setup.js"}}'),
  ], metadata, { generatedAt: '2026-10-11T00:00:00.000Z' });

  const sarif = toSarif(manifest);
  assert.equal(sarif.$schema, 'https://json.schemastore.org/sarif-2.1.0.json');
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].tool.driver.name, 'HostLatch');
  assert.equal(sarif.runs[0].results.length, 2);
  const ideResult = sarif.runs[0].results.find((result) => result.ruleId === 'HL-IDE-201');
  assert.equal(ideResult.level, 'error');
  assert.equal(
    ideResult.locations[0].physicalLocation.artifactLocation.uri,
    'folder%20with%20spaces/.vscode/tasks.json',
  );
  assert.deepEqual(ideResult.locations[0].physicalLocation.region, { startLine: 1, endLine: 1 });
  assert.match(ideResult.message.text, /Activation path:/);
  assert.match(ideResult.partialFingerprints['hostlatchFinding/v1'], /^[a-f0-9]{64}$/);
  assert.equal(sarif.runs[0].tool.driver.rules.length, 2);
  assert.doesNotMatch(JSON.stringify(sarif), /private[/\\]workspace/i);
});

test('SARIF export is valid when a scan has no findings', () => {
  const manifest = analyzeChanges([
    change('src/app.js', 'export const value = 1;\n'),
  ], metadata, { generatedAt: '2026-10-11T00:00:00.000Z' });

  const sarif = toSarif(manifest);
  assert.deepEqual(sarif.runs[0].tool.driver.rules, []);
  assert.deepEqual(sarif.runs[0].results, []);
  assert.equal(sarif.runs[0].properties.decision, 'allow');
});

test('SARIF export rejects non-HostLatch input', () => {
  assert.throws(() => toSarif({}), /supported HostLatch manifest/);
});

test('CLI writes SARIF without changing the enforcement decision', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hostlatch-sarif-test-'));
  const output = path.join(root, 'hostlatch.sarif');
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@hostlatch.local'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'HostLatch Test'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), '# fixture\n');
    execFileSync('git', ['add', 'README.md'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'base'], { cwd: root });
    await mkdir(path.join(root, '.vscode'));
    await writeFile(path.join(root, '.vscode', 'tasks.json'), '{"tasks":[{"command":"node payload.js"}]}\n');

    const result = spawnSync(process.execPath, [
      path.resolve('bin/hostlatch.js'),
      'scan',
      root,
      '--base',
      'HEAD',
      '--sarif',
      '--output',
      output,
    ], { encoding: 'utf8' });

    assert.equal(result.status, 3);
    assert.equal(JSON.parse(result.stdout).version, '2.1.0');
    assert.equal(JSON.parse(await readFile(output, 'utf8')).runs[0].results[0].ruleId, 'HL-IDE-201');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
