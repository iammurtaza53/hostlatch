import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPromotionBundle } from './bundle.js';
import { exitCodeFor, scanRepository } from './scan.js';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function usage() {
  return `HostLatch — the trust-handoff firewall for AI-written repositories

Usage:
  hostlatch scan [path] [options]
  hostlatch bundle [path] --output <directory> [options]
  hostlatch explain <manifest.json>
  hostlatch --version

Scan options:
  --base <ref>             Compare with this Git commit or ref
  --json                   Print the complete manifest as JSON
  --output <path>          Manifest file for scan; new bundle directory for bundle
  --fail-on <level>        block (default), review, or never
  --max-file-bytes <n>     Inspection limit per file (default: 1048576)
  -h, --help               Show this help

Exit codes:
  0  allowed, or below the configured failure threshold
  2  manual review required
  3  dangerous trust handoff blocked
  1  usage or scanner error`;
}

function parseScanArgs(args) {
  const options = {
    path: '.',
    base: undefined,
    json: false,
    output: undefined,
    failOn: 'block',
    maxFileBytes: 1024 * 1024,
  };
  let pathSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') options.json = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '--base') options.base = requiredValue(args, ++index, '--base');
    else if (arg === '--output') options.output = requiredValue(args, ++index, '--output');
    else if (arg === '--fail-on') options.failOn = requiredValue(args, ++index, '--fail-on');
    else if (arg === '--max-file-bytes') {
      options.maxFileBytes = Number(requiredValue(args, ++index, '--max-file-bytes'));
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!pathSeen) {
      options.path = arg;
      pathSeen = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!['block', 'review', 'never'].includes(options.failOn)) {
    throw new Error('--fail-on must be block, review, or never');
  }
  if (!Number.isSafeInteger(options.maxFileBytes) || options.maxFileBytes < 1024) {
    throw new Error('--max-file-bytes must be an integer of at least 1024');
  }
  return options;
}

function requiredValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`);
  return value;
}

function printHuman(manifest) {
  const { summary, scan, findings } = manifest;
  const verdict = summary.decision.toUpperCase();
  console.log(`\nHostLatch ${verdict}  risk=${summary.riskScore}/100  manifest=${manifest.manifestId}`);
  console.log(`Repository: ${scan.repository || '<unknown>'}  base: ${scan.baseRef || '<unknown>'}`);
  console.log(`Changed files: ${summary.changedFiles}  findings: ${summary.findings}`);

  if (!findings.length) {
    console.log('\nNo changed trust-handoff surfaces were detected.');
    return;
  }

  for (const item of findings) {
    console.log(`\n[${item.severity.toUpperCase()}] ${item.ruleId}  ${item.path}`);
    console.log(item.title);
    console.log(`  path: ${item.consumer} -> ${item.trigger} -> ${item.effect}`);
    for (const evidence of item.evidence) console.log(`  evidence: ${evidence}`);
    console.log(`  action: ${item.recommendation}`);
  }
}

async function writeManifest(file, manifest) {
  const target = path.resolve(file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return target;
}

async function explain(file) {
  if (!file) throw new Error('explain requires a manifest.json path');
  const manifest = JSON.parse(await fs.readFile(path.resolve(file), 'utf8'));
  if (manifest.schemaVersion !== 1 || !manifest.summary || !Array.isArray(manifest.findings)) {
    throw new Error('File is not a supported HostLatch manifest');
  }
  printHuman(manifest);
  console.log(`\nActivation graph: ${manifest.activationGraph.nodes.length} nodes, ${manifest.activationGraph.edges.length} edges`);
}

function printBundle(result) {
  const quarantined = result.inventory.filter((item) => item.zone === 'quarantine').length;
  const dataPlane = result.inventory.length - quarantined;
  console.log(`\nHostLatch bundle: ${result.target}`);
  console.log(`Manifest: ${result.manifest.manifestId}  decision: ${result.manifest.summary.decision.toUpperCase()}`);
  console.log(`Data-plane changes: ${dataPlane}  quarantined changes: ${quarantined}`);
  console.log('Nothing in the bundle was executed. Review manifest.json before promotion.');
}

export async function main(argv) {
  if (argv.includes('--version') || argv[0] === 'version') {
    const pkg = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    console.log(pkg.version);
    return;
  }
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help' || argv[0] === 'help') {
    console.log(usage());
    return;
  }
  if (argv[0] === 'explain') {
    await explain(argv[1]);
    return;
  }

  const command = ['scan', 'bundle'].includes(argv[0]) ? argv[0] : 'scan';
  const args = ['scan', 'bundle'].includes(argv[0]) ? argv.slice(1) : argv;
  const options = parseScanArgs(args);
  if (options.help) {
    console.log(usage());
    return;
  }

  if (command === 'bundle') {
    const result = await createPromotionBundle(options.path, options.output, options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printBundle(result);
    process.exitCode = exitCodeFor(result.manifest, options.failOn);
    return;
  }

  const manifest = await scanRepository(options.path, options);
  let outputPath = null;
  if (options.output) outputPath = await writeManifest(options.output, manifest);
  if (options.json) console.log(JSON.stringify(manifest, null, 2));
  else {
    printHuman(manifest);
    if (outputPath) console.log(`\nManifest written to ${outputPath}`);
  }
  process.exitCode = exitCodeFor(manifest, options.failOn);
}
