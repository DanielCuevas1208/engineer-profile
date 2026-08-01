import type { PrivacyConfig } from "../types.js";

const DEFAULT_BLOCKED_PATTERNS = [/password/i, /secret/i, /api[_-]?key/i, /access[_ -]?token/i, /bearer\s+[a-z0-9]/i];

export function isProjectVisible(slug: string, privacy: PrivacyConfig): boolean {
  return !privacy.hiddenProjects.includes(slug);
}

export function redactEmail(email: string | null, privacy: PrivacyConfig): string | null {
  if (!email || !privacy.redactEmails) return email;
  const [local, domain] = email.split("@");
  if (!domain) return "***@redacted";
  return `${local.slice(0, 1)}***@${domain}`;
}

export function isCommitMessageAllowed(
  message: string,
  blockedPatterns: RegExp[] = DEFAULT_BLOCKED_PATTERNS
): boolean {
  return !blockedPatterns.some((pattern) => pattern.test(message));
}

export function filterCommitMessages(
  messages: string[],
  blockedPatterns: RegExp[] = DEFAULT_BLOCKED_PATTERNS
): string[] {
  return messages.filter((message) => isCommitMessageAllowed(message, blockedPatterns));
}

export function applyPrivacyToProject<T extends { slug: string; visible: number }>(
  project: T,
  privacy: PrivacyConfig
): T {
  if (!isProjectVisible(project.slug, privacy)) {
    return { ...project, visible: 0 };
  }
  return project;
}

export function mergePrivacy(
  base: PrivacyConfig,
  overrides: Partial<PrivacyConfig>
): PrivacyConfig {
  const maxCommits = overrides.maxCommitsPerProject ?? base.maxCommitsPerProject;
  return {
    hiddenProjects: overrides.hiddenProjects ?? base.hiddenProjects,
    redactEmails: overrides.redactEmails ?? base.redactEmails,
    maxCommitsPerProject: Number.isFinite(maxCommits) && maxCommits > 0
      ? Math.floor(maxCommits)
      : base.maxCommitsPerProject,
  };
}

export function parsePrivacyJson(json: string): PrivacyConfig {
  const parsed = JSON.parse(json) as Partial<PrivacyConfig>;
  return mergePrivacy(
    { hiddenProjects: [], redactEmails: true, maxCommitsPerProject: 50 },
    parsed
  );
}