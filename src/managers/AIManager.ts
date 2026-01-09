/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: AIManager is a static class> */
import type { AICommitResponse, AuthConfig } from "../types/index.js";

export class AIManager {
  private static baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  static async fetchModels(key: string): Promise<string[]> {
    try {
      const res = await fetch(`${AIManager.baseUrl}/models?key=${key}`);
      const data = (await res.json()) as {
        models: { name: string; supportedGenerationMethods: string[] }[];
        error?: { message: string };
      };
      if (data.error) throw new Error(data.error.message);
      // Filter only Gemini models that support content generation
      return (data.models || [])
        .filter(
          (m: { name: string; supportedGenerationMethods: string[] }) =>
            m.name.includes("gemini") &&
            m.supportedGenerationMethods?.includes("generateContent"),
        )
        .map((m: { name: string }) => m.name.replace("models/", ""))
        .sort((a: string, b: string) => b.localeCompare(a)); // Newest first
    } catch (e) {
      throw new Error(`Failed to fetch models: ${e}`);
    }
  }

  static async generateCommitDetails(
    diff: string,
    auth: AuthConfig,
  ): Promise<AICommitResponse> {
    if (!auth.apiKey)
      throw new Error("API Key not found. Run 'digest set-key <KEY>' first.");
    const model = auth.model || "gemini-1.5-flash";

    const prompt = `
        You are a Senior DevOps Engineer. Analyze the following 'git diff'. 
        Return a valid JSON object ONLY (no markdown formatting, no code blocks) with:
        1. "commitMessage": A conventional commit message (type(scope): description).
        2. "changelog": A concise bullet point for a changelog. Use an emoji and bold category at the start. 
           Example: "🚀 **Feature**: Added new logging system" or "🐛 **Fix**: Resolved crash in scanner".
        3. "bump": One of "major", "minor", "patch", or "none" based on SemVer rules.

        DIFF:
        ${diff.substring(0, 30000)} ${
          diff.length > 30000 ? "...(truncated)" : ""
        }
        `;

    try {
      const res = await fetch(
        `${AIManager.baseUrl}/models/${model}:generateContent?key=${auth.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );
      const data = (await res.json()) as {
        candidates?: {
          content?: {
            parts?: {
              text?: string;
            }[];
          };
        }[];
        error?: { message: string };
      };
      if (data.error) throw new Error(data.error.message);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from AI");

      return JSON.parse(text);
    } catch (e) {
      throw new Error(`AI Generation failed: ${e}`);
    }
  }
}
