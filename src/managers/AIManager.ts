// --- src/managers/AIManager.ts ---
/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: AIManager is a static class> */
import type { AICommitResponse, AuthConfig } from "../types/index.js";

/**
 * Manages interactions with AI services (Google Generative AI).
 * Handles fetching available models and generating commit details from diffs.
 */
export class AIManager {
  /**
   * Base URL for Google Generative AI API version 1beta.
   * @private
   */
  private static baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  /**
   * Fetches the list of available AI models from the API.
   * Filters specifically for Gemini and Gemma models that support content generation.
   *
   * @param key - The API key for authentication.
   * @returns A promise that resolves to a sorted array of model names.
   * @throws Error if the fetch fails or the API returns an error.
   */
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
            (m.name.includes("gemini") || m.name.includes("gemma")) &&
            m.supportedGenerationMethods?.includes("generateContent"),
        )
        .map((m: { name: string }) => m.name.replace("models/", ""))
        .sort((a: string, b: string) => {
          return b.localeCompare(a);
        });
    } catch (e) {
      throw new Error(`Failed to fetch models: ${e}`);
    }
  }

  /**
   * Generates commit message, changelog, and provides a security check for a given Git diff using AI.
   *
   * @param diff - The Git diff string to analyze.
   * @param auth - The authentication configuration containing the API key and desired model.
   * @returns A promise that resolves to an AICommitResponse object containing the generated details.
   * @throws Error if the API key is missing, the AI response is empty, or the request fails.
   */
  static async generateCommitDetails(
    diff: string,
    auth: AuthConfig,
  ): Promise<AICommitResponse> {
    if (!auth.apiKey)
      throw new Error("API Key missing. Run 'digest set-key <KEY>' first.");
    const model = auth.model || "gemini-1.5-flash";

    const prompt = `
        You are a Senior DevOps Engineer. Analyze the following 'git diff'. 
        You MUST return a valid JSON object ONLY. Do not wrap it in markdown code blocks.
        
        JSON Structure:
        {
          "commitMessage": "type(scope): description",
          "changelog": "String. Multi-line string with bullet points.",
          "bump": "major" | "minor" | "patch" | "none",
          "checkResult": {
            "isSafe": boolean,
            "message": "Status message or warning about secrets found. Empty if safe."
          }
        }

        Rules for 'checkResult':
        - Scan the DIFF for accidental leaks of secrets (e.g., API keys, passwords, private keys, .env values, tokens).
        - If any secret is found, set 'isSafe' to false and provide a descriptive warning in 'message'.
        - If the changes look safe, set 'isSafe' to true.

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
      };
      if (data.error)
        throw new Error(`${data.error.message} (Model: ${model})`);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from AI");

      // 🔥 FIX 3: Robust Markdown Stripping (Nggak peduli kalau ada teks di depan/belakang)
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const cleanJson = match ? match[1].trim() : text.trim();

      return JSON.parse(cleanJson);
    } catch (e) {
      throw new Error(
        `AI Generation failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
