import { analyzeChange } from './rules.js';
import { collectChanges, repositoryMetadata, resolveBase, resolveRepository } from './git.js';
import { compareFindings, sha256, slug, stableStringify } from './util.js';

const VERSION = '0.1.0';
const SCORE_WEIGHT = Object.freeze({ critical: 100, high: 40, medium: 10, low: 2, info: 0 });

function summarize(findings, changedFiles) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byCategory = {};
  let score = 0;
  for (const item of findings) {
    bySeverity[item.severity] += 1;
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    score += SCORE_WEIGHT[item.severity];
  }
  const decision = bySeverity.critical || bySeverity.high
    ? 'block'
    : bySeverity.medium || bySeverity.low
      ? 'review'
      : 'allow';
  return {
    decision,
    riskScore: Math.min(100, score),
    changedFiles,
    findings: findings.length,
    bySeverity,
    byCategory,
  };
}

function activationGraph(findings) {
  const nodes = new Map();
  const edges = new Map();

  function addNode(id, type, label) {
    if (!nodes.has(id)) nodes.set(id, { id, type, label });
  }
  function addEdge(from, to, relation) {
    const id = `${from}|${relation}|${to}`;
    if (!edges.has(id)) edges.set(id, { from, to, relation });
  }

  for (const item of findings) {
    const artifact = `artifact:${item.path}`;
    const consumer = `consumer:${slug(item.consumer)}`;
    const trigger = `trigger:${slug(item.trigger)}`;
    const effect = `effect:${slug(item.effect)}`;
    addNode(artifact, 'artifact', item.path);
    addNode(consumer, 'consumer', item.consumer);
    addNode(trigger, 'trigger', item.trigger);
    addNode(effect, 'effect', item.effect);
    addEdge(artifact, consumer, 'loaded-by');
    addEdge(consumer, trigger, 'activated-when');
    addEdge(trigger, effect, 'can-cause');
  }

  return {
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) => {
      return left.from.localeCompare(right.from) || left.to.localeCompare(right.to);
    }),
  };
}

function publicChange(change) {
  return {
    path: change.path,
    oldPath: change.oldPath || undefined,
    status: change.status,
    untracked: Boolean(change.untracked),
    mode: change.mode,
    oldMode: change.oldMode,
    contentHash: change.contentHash,
    baseContentHash: change.baseContentHash,
    truncated: Boolean(change.truncated),
  };
}

export function analyzeChanges(changes, metadata = {}, options = {}) {
  const context = { root: metadata.root || process.cwd() };
  const findings = changes
    .flatMap((change) => analyzeChange(change, context))
    .sort(compareFindings);
  const graph = activationGraph(findings);
  const summary = summarize(findings, changes.length);
  const generatedAt = options.generatedAt || new Date().toISOString();

  const payload = {
    schemaVersion: 1,
    tool: { name: 'HostLatch', version: VERSION },
    scan: {
      repository: metadata.repository || null,
      branch: metadata.branch || null,
      baseRef: metadata.baseRef || null,
      baseCommit: metadata.baseCommit || null,
      headCommit: metadata.headCommit || null,
      dirty: Boolean(metadata.dirty),
    },
    changes: changes.map(publicChange),
    findings,
    activationGraph: graph,
    summary,
  };
  const manifestId = `hl_${sha256(stableStringify(payload)).slice(0, 24)}`;
  return { ...payload, manifestId, generatedAt };
}

export async function scanRepository(input = '.', options = {}) {
  const root = await resolveRepository(input);
  const base = await resolveBase(root, options.base);
  const [changes, metadata] = await Promise.all([
    collectChanges(root, base.commit, { maxFileBytes: options.maxFileBytes }),
    repositoryMetadata(root, base),
  ]);
  return analyzeChanges(changes, metadata);
}

export function exitCodeFor(manifest, failOn = 'block') {
  if (failOn === 'never') return 0;
  if (manifest.summary.decision === 'block') return 3;
  if (failOn === 'review' && manifest.summary.decision === 'review') return 2;
  return 0;
}
