export interface AppConfig {
  ignoredPatterns: Set<string>;
  ignoredExts: Set<string>;
  maxFileSize: number;
  forceInclude: Set<string>; // ← BARU
  prePushScripts?: string[];
}

export interface ScanStats {
  files: { path: string; relPath: string; size: number; ext: string }[];
  tree: string[];
  skippedCount: number;
  skippedSize: number;
  totalSize: number;
  forceIncludedCount: number; // ← BARU
  extStats: Record<string, { count: number; size: number }>;
  duration: string;
}

export interface AuthConfig {
  apiKey?: string;
  model?: string;
}

export interface SecretCheckResult {
  isSafe: boolean;
  message: string;
}

export interface AICommitResponse {
  commitMessage: string;
  changelog: string;
  bump: "major" | "minor" | "patch" | "none";
  checkResult?: SecretCheckResult;
}
