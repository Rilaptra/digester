// --- src/managers/AIManager.ts ---
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

      // 🔥 UPDATE: Filter support for Gemini AND Gemma
      return (data.models || [])
        .filter(
          (m: { name: string; supportedGenerationMethods: string[] }) =>
            // Cek apakah nama model mengandung 'gemini' ATAU 'gemma'
            (m.name.includes("gemini") || m.name.includes("gemma")) &&
            m.supportedGenerationMethods?.includes("generateContent"),
        )
        .map((m: { name: string }) => m.name.replace("models/", ""))
        .sort((a: string, b: string) => {
          // Sort: Prefer Gemini over Gemma logic, or just alphanumeric descending
          // Kita tetep descending biar versi terbaru (misal 1.5) ada di atas
          return b.localeCompare(a);
        });
    } catch (e) {
      throw new Error(`Failed to fetch models: ${e}`);
    }
  }

  static async generateCommitDetails(
    diff: string,
    auth: AuthConfig,
  ): Promise<AICommitResponse> {
    if (!auth.apiKey)
      throw new Error("API Key missing. Run 'digest set-key <KEY>' first.");
    const model = auth.model || "gemini-1.5-flash";

    // 🔥 UPDATE PROMPT: Strict emoji enforcement and conventional style
    const prompt = `
        You are a Senior DevOps Engineer. Analyze the following 'git diff'. 
        You MUST return a valid JSON object ONLY. Do not wrap it in markdown code blocks.
        
        JSON Structure:
        {
          "commitMessage": "type(scope): description",
          "changelog": "String. Multi-line string with bullet points.",
          "bump": "major" | "minor" | "patch" | "none"
        }

        Rules for 'changelog':
        - EVERY line MUST start with a relevant emoji (e.g., ✨, 🚀, 🛠️, 📝, 📦, 🎨, ⚡️, ⚙️, 📖, 📜, 🏷️, 🧹, 🐛).
        - Use emojis consistent with the project's history in CHANGELOG.md.
        - Format: "- [Emoji] [Description]"
        - If multiple files/features changed, describe them in detail across multiple lines (separated by \\n).
        - Do not be generic; explain WHAT changed and WHY.

        Rules for 'commitMessage':
        - Follow Conventional Commits (e.g., feat: ..., fix: ..., refactor: ...).

        DIFF:
        ${diff.substring(0, 30000)} ${
          diff.length > 30000 ? "...(truncated)" : ""
        }
        `;

    try {
      const isGemini = model.toLowerCase().includes("gemini");
      const bodyPayload: {
        contents: [{ parts: [{ text: string }] }];
        generationConfig?: { responseMimeType: string };
      } = {
        contents: [{ parts: [{ text: prompt }] }],
      };

      if (isGemini) {
        bodyPayload.generationConfig = { responseMimeType: "application/json" };
      }

      const res = await fetch(
        `${AIManager.baseUrl}/models/${model}:generateContent?key=${auth.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
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
      }; // Cast any biar cepet, logic error handle sama
      if (data.error)
        throw new Error(`${data.error.message} (Model: ${model})`);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from AI");

      const cleanJson = text
        .replace(/^```json\s*/g, "")
        .replace(/^```\s*/g, "")
        .replace(/\s*```$/g, "")
        .trim();

      return JSON.parse(cleanJson);
    } catch (e) {
      throw new Error(
        `AI Generation failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
