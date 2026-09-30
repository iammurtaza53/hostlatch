import { promises as fs } from 'node:fs';
import path from 'node:path';
import { collectChanges, repositoryMetadata, resolveBase, resolveRepository } from './git.js';
import { analyzeChanges } from './scan.js';
import { isInside, sha256 } from './util.js';

async function ensureNewDirectory(target) {
  try {
    await fs.lstat(target);
    throw new Error(`Bundle output already exists: ${target}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await fs.mkdir(target, { recursive: true });
}

async function materializeChange(root, target, zone, change) {
  if (change.status === 'D') return null;
  const source = path.resolve(root, change.path);
  if (!isInside(root, source)) throw new Error(`Changed path escapes repository: ${change.path}`);

  let relativeOutput = path.join(zone, change.path);
  if (change.isSymlink) relativeOutput = `${relativeOutput}.symlink-target.txt`;
  const destination = path.resolve(target, relativeOutput);
  if (!isInside(target, destination)) throw new Error(`Bundle path escapes output: ${change.path}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });

  if (change.isSymlink) {
    await fs.writeFile(destination, `${change.symlinkTarget || ''}\n`, 'utf8');
    return relativeOutput.replaceAll('\\', '/');
  }

  const stat = await fs.lstat(source);
  if (!stat.isFile()) throw new Error(`Cannot materialize non-regular file: ${change.path}`);
  await fs.copyFile(source, destination);
  const copiedHash = sha256(await fs.readFile(destination));
  if (change.contentHash && copiedHash !== change.contentHash) {
    throw new Error(`File changed during bundle creation: ${change.path}`);
  }
  return relativeOutput.replaceAll('\\', '/');
}

function bundleReadme(manifest, inventory) {
  const dataCount = inventory.filter((item) => item.zone === 'data-plane').length;
  const quarantineCount = inventory.filter((item) => item.zone === 'quarantine').length;
  return `# HostLatch promotion bundle

Manifest: \`${manifest.manifestId}\`  
Decision: **${manifest.summary.decision.toUpperCase()}**

This directory is inert evidence. Nothing here has been executed.

- \`data-plane/\`: ${dataCount} ordinary changed paths with no detected activation surface.
- \`quarantine/\`: ${quarantineCount} changed paths that require review or are blocked.
- \`inventory.json\`: exact path, zone, status, mode, and content hash for every change.
- \`manifest.json\`: findings and activation graph behind the decision.

Do not copy quarantined files into a trusted repository until every activation path is understood. Files in \`data-plane/\` are only free of known HostLatch activation findings; they are not guaranteed safe or correct.
`;
}

export async function createPromotionBundle(input, output, options = {}) {
  if (!output) throw new Error('bundle requires --output <directory>');
  const root = await resolveRepository(input);
  const base = await resolveBase(root, options.snapshot ? '<empty-tree>' : options.base);
  const [changes, metadata] = await Promise.all([
    collectChanges(root, base.commit, { maxFileBytes: options.maxFileBytes }),
    repositoryMetadata(root, base),
  ]);
  const manifest = analyzeChanges(changes, metadata);
  const target = path.resolve(output);
  if (target === root) throw new Error('Bundle output cannot be the repository root');
  await ensureNewDirectory(target);

  const quarantinedPaths = new Set(manifest.findings.map((item) => item.path));
  const inventory = [];
  for (const change of changes) {
    const zone = quarantinedPaths.has(change.path) ? 'quarantine' : 'data-plane';
    const materializedPath = await materializeChange(root, target, zone, change);
    inventory.push({
      path: change.path,
      oldPath: change.oldPath || undefined,
      status: change.status,
      zone,
      mode: change.mode,
      oldMode: change.oldMode,
      contentHash: change.contentHash,
      materializedPath,
    });
  }

  await Promise.all([
    fs.writeFile(path.join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(target, 'inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(target, 'README.md'), bundleReadme(manifest, inventory), 'utf8'),
  ]);
  return { target, manifest, inventory };
}
