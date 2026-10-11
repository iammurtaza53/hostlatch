import { sha256, stableStringify } from './util.js';

const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';
const INFORMATION_URI = 'https://github.com/iammurtaza53/hostlatch';
const HELP_URI = `${INFORMATION_URI}/blob/main/docs/RULES.md`;

const SARIF_LEVEL = Object.freeze({
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'warning',
  info: 'note',
});

const SECURITY_SEVERITY = Object.freeze({
  critical: '9.8',
  high: '8.0',
  medium: '5.0',
  low: '2.5',
  info: '0.0',
});

function artifactUri(value) {
  return String(value ?? '')
    .replaceAll('\\', '/')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function levelFor(severity) {
  return SARIF_LEVEL[severity] || 'warning';
}

function securitySeverityFor(severity) {
  return SECURITY_SEVERITY[severity] || '5.0';
}

function ruleFromFinding(finding) {
  return {
    id: finding.ruleId,
    shortDescription: { text: finding.title },
    fullDescription: {
      text: `${finding.consumer} can activate repository-controlled behavior through ${finding.trigger}.`,
    },
    helpUri: HELP_URI,
    help: { text: finding.recommendation },
    defaultConfiguration: { level: levelFor(finding.severity) },
    properties: {
      category: finding.category,
      precision: 'high',
      'security-severity': securitySeverityFor(finding.severity),
      tags: ['security', 'ai-agent-security', finding.category],
    },
  };
}

function messageFor(finding) {
  const activation = `${finding.consumer} -> ${finding.trigger} -> ${finding.effect}`;
  return `${finding.title}. Activation path: ${activation}. ${finding.recommendation}`;
}

function fingerprintFor(finding) {
  return sha256(stableStringify({
    ruleId: finding.ruleId,
    path: finding.path,
    evidence: finding.evidence,
  }));
}

function resultFromFinding(finding) {
  return {
    ruleId: finding.ruleId,
    level: levelFor(finding.severity),
    message: { text: messageFor(finding) },
    locations: [{
      physicalLocation: {
        artifactLocation: { uri: artifactUri(finding.path) },
        region: finding.location || { startLine: 1, endLine: 1 },
      },
    }],
    partialFingerprints: {
      'hostlatchFinding/v1': fingerprintFor(finding),
    },
    properties: {
      severity: finding.severity,
      category: finding.category,
      status: finding.status,
      consumer: finding.consumer,
      trigger: finding.trigger,
      effect: finding.effect,
      evidence: finding.evidence,
      recommendation: finding.recommendation,
    },
  };
}

export function toSarif(manifest) {
  if (!manifest || !Array.isArray(manifest.findings) || !manifest.tool) {
    throw new Error('A supported HostLatch manifest is required for SARIF output');
  }

  const rules = new Map();
  for (const finding of manifest.findings) {
    if (!rules.has(finding.ruleId)) rules.set(finding.ruleId, ruleFromFinding(finding));
  }

  return {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: manifest.tool.name,
          version: manifest.tool.version,
          informationUri: INFORMATION_URI,
          rules: [...rules.values()].sort((left, right) => left.id.localeCompare(right.id)),
        },
      },
      automationDetails: { id: manifest.manifestId },
      results: manifest.findings.map(resultFromFinding),
      properties: {
        hostlatchManifestId: manifest.manifestId,
        decision: manifest.summary.decision,
        riskScore: manifest.summary.riskScore,
        baseRef: manifest.scan.baseRef,
        baseCommit: manifest.scan.baseCommit,
        headCommit: manifest.scan.headCommit,
      },
    }],
  };
}
