export interface AppConfig {
  ignoredPatterns: Set<string>;
  ignoredExts: Set<string>;
  maxFileSize: number;
}

export interface ScanStats {
  files: { path: string; relPath: string; size: number; ext: string }[];
  tree: string[];
  skippedCount: number;
  skippedSize: number;
  totalSize: number;
  extStats: Record<string, { count: number; size: number }>;
  duration: string;
}

export interface AuthConfig {
  apiKey?: string;
  model?: string;
}

export interface AICommitResponse {
  commitMessage: string;
  changelog: string;
  bump: "major" | "minor" | "patch" | "none";
}
