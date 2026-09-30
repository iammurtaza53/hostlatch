import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { normalizeRepoPath, sha256 } from './util.js';

const execFileAsync = promisify(execFile);
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

async function git(cwd, args, options = {}) {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      ...options,
    });
    return result.stdout;
  } catch (error) {
    const message = String(error.stderr || error.message || '').trim();
    throw new Error(message || `git ${args.join(' ')} failed`);
  }
}

async function tryGit(cwd, args) {
  try {
    return (await git(cwd, args)).trim();
  } catch {
    return null;
  }
}

export async function resolveRepository(input = '.') {
  const requested = path.resolve(input);
  const root = await tryGit(requested, ['rev-parse', '--show-toplevel']);
  if (!root) throw new Error(`${requested} is not inside a Git repository`);
  return path.resolve(root);
}

export async function resolveBase(root, requestedRef) {
  if (requestedRef) {
    if (requestedRef === '<empty-tree>') {
      return { ref: '<empty-tree>', commit: EMPTY_TREE };
    }
    const commit = await tryGit(root, ['rev-parse', '--verify', `${requestedRef}^{commit}`]);
    if (!commit) throw new Error(`Base ref does not resolve to a commit: ${requestedRef}`);
    return { ref: requestedRef, commit };
  }

  const head = await tryGit(root, ['rev-parse', '--verify', 'HEAD']);
  if (!head) return { ref: '<empty-tree>', commit: EMPTY_TREE };

  const originHead = await tryGit(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  const candidates = [originHead, 'origin/main', 'main', 'origin/master', 'master']
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);

  for (const candidate of candidates) {
    const candidateCommit = await tryGit(root, ['rev-parse', '--verify', `${candidate}^{commit}`]);
    if (!candidateCommit || candidateCommit === head) continue;
    const mergeBase = await tryGit(root, ['merge-base', 'HEAD', candidate]);
    if (mergeBase) return { ref: candidate, commit: mergeBase };
  }

  const parent = await tryGit(root, ['rev-parse', '--verify', 'HEAD^']);
  return parent
    ? { ref: 'HEAD^', commit: parent }
    : { ref: '<empty-tree>', commit: EMPTY_TREE };
}

function parseNameStatus(output) {
  const tokens = output.split('\0');
  const changes = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const status = tokens[index];
    if (!status) continue;
    const code = status[0];
    if (code === 'R' || code === 'C') {
      const oldPath = tokens[++index];
      const nextPath = tokens[++index];
      changes.push({ status: code, oldPath: normalizeRepoPath(oldPath), path: normalizeRepoPath(nextPath) });
    } else {
      changes.push({ status: code, path: normalizeRepoPath(tokens[++index]) });
    }
  }
  return changes;
}

function parseModeMap(output) {
  const modes = new Map();
  for (const entry of output.split('\0')) {
    if (!entry) continue;
    const separator = entry.indexOf('\t');
    if (separator === -1) continue;
    const metadata = entry.slice(0, separator);
    const relativePath = entry.slice(separator + 1);
    const mode = metadata.split(/\s+/, 1)[0];
    if (mode && relativePath) modes.set(normalizeRepoPath(relativePath), mode);
  }
  return modes;
}

async function currentMode(root, relativePath, indexedModes) {
  const tracked = indexedModes.get(normalizeRepoPath(relativePath));
  if (tracked) return tracked;
  try {
    const stat = await fs.lstat(path.join(root, relativePath));
    if (stat.isSymbolicLink()) return '120000';
    return stat.mode & 0o111 ? '100755' : '100644';
  } catch {
    return null;
  }
}

async function readCurrent(root, relativePath, maxFileBytes) {
  const fullPath = path.join(root, relativePath);
  try {
    const stat = await fs.lstat(fullPath);
    if (stat.isDirectory()) return { content: '', truncated: false, symlinkTarget: null };
    if (stat.isSymbolicLink()) {
      const target = await fs.readlink(fullPath);
      return { content: target, hash: sha256(target), truncated: false, symlinkTarget: target };
    }
    if (stat.size > maxFileBytes) return { content: '', hash: null, truncated: true, symlinkTarget: null };
    const bytes = await fs.readFile(fullPath);
    return {
      content: bytes.toString('utf8'),
      hash: sha256(bytes),
      truncated: false,
      symlinkTarget: null,
    };
  } catch {
    return { content: '', hash: null, truncated: false, symlinkTarget: null };
  }
}

async function readBase(root, base, relativePath, maxFileBytes) {
  try {
    const content = await git(root, ['show', `${base}:${normalizeRepoPath(relativePath)}`]);
    if (Buffer.byteLength(content) > maxFileBytes) return { content: '', truncated: true };
    return { content, truncated: false };
  } catch {
    return { content: '', truncated: false };
  }
}

export async function collectChanges(root, base, options = {}) {
  const maxFileBytes = options.maxFileBytes ?? 1024 * 1024;
  const diffOutput = await git(root, ['diff', '--name-status', '-z', '--no-renames', base, '--']);
  const tracked = parseNameStatus(diffOutput);
  const trackedPaths = new Set(tracked.map((change) => change.path));
  const untrackedOutput = await git(root, ['ls-files', '--others', '--exclude-standard', '-z']);
  const untracked = untrackedOutput
    .split('\0')
    .filter(Boolean)
    .map(normalizeRepoPath)
    .filter((file) => !trackedPaths.has(file))
    .map((file) => ({ status: 'A', path: file, untracked: true }));

  // Resolve tracked modes in two Git calls instead of spawning two Git
  // processes for every changed path. Snapshot scans can cover thousands of
  // files, and per-file process fan-out is especially expensive on Windows.
  const [indexedModeOutput, baseModeOutput] = await Promise.all([
    git(root, ['ls-files', '-s', '-z']),
    git(root, ['ls-tree', '-r', '-z', base]),
  ]);
  const indexedModes = parseModeMap(indexedModeOutput);
  const baseModes = parseModeMap(baseModeOutput);

  const changes = await Promise.all([...tracked, ...untracked].map(async (change) => {
    const previousPath = change.oldPath || change.path;
    const [current, previous, mode, oldMode] = await Promise.all([
      change.status === 'D'
        ? { content: '', hash: null, truncated: false, symlinkTarget: null }
        : readCurrent(root, change.path, maxFileBytes),
      change.status === 'A'
        ? Promise.resolve({ content: '', truncated: false })
        : readBase(root, base, previousPath, maxFileBytes),
      change.status === 'D'
        ? Promise.resolve(null)
        : currentMode(root, change.path, indexedModes),
      Promise.resolve(change.status === 'A' ? null : baseModes.get(previousPath) || null),
    ]);
    return {
      ...change,
      content: current.content,
      baseContent: previous.content,
      contentHash: current.hash,
      baseContentHash: previous.content ? sha256(previous.content) : null,
      truncated: current.truncated || previous.truncated,
      mode,
      oldMode,
      isSymlink: mode === '120000',
      symlinkTarget: current.symlinkTarget || (mode === '120000' ? current.content.trim() : null),
    };
  }));

  return changes.sort((left, right) => left.path.localeCompare(right.path));
}

export async function repositoryMetadata(root, base) {
  const [head, branch, status] = await Promise.all([
    tryGit(root, ['rev-parse', '--verify', 'HEAD']),
    tryGit(root, ['branch', '--show-current']),
    tryGit(root, ['status', '--porcelain=v1']),
  ]);
  return {
    root,
    repository: path.basename(root),
    branch: branch || null,
    baseRef: base.ref,
    baseCommit: base.commit,
    headCommit: head || null,
    dirty: Boolean(status),
  };
}
