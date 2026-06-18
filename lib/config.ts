import { z } from "zod";

const envSchema = z.object({
  // Supabase — required at startup
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ message: "NEXT_PUBLIC_SUPABASE_URL is required" })
    .url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string({
    message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required",
  }),
  SUPABASE_SERVICE_ROLE_KEY: z.string({
    message: "SUPABASE_SERVICE_ROLE_KEY is required",
  }),

  // LLM — optional until Phase 4
  LLM_PROVIDER: z.enum(["groq", "openai", "anthropic"]).default("groq"),
  LLM_MODEL: z.string().default(""),
  LLM_API_KEY: z.string().default(""),

  // Embeddings — OPENAI_API_KEY used by embed.ts (text-embedding-3-small, 1536 dims)
  OPENAI_API_KEY: z.string().default(""),

  // External data APIs — optional (demo data pre-warmed in query_cache by seed)
  MARKET_DATA_API_KEY: z.string().default(""),
  NEWS_API_KEY: z.string().default(""),

  // App
  APP_URL: z
    .string()
    .url({ message: "APP_URL must be a valid URL" })
    .default("http://localhost:3000"),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  • ${i.path.join(".") || "unknown"}: ${i.message}`)
      .join("\n");
    console.error(`\n[config] Missing or invalid environment variables:\n${missing}\n`);
    process.exit(1);
  }

  return result.data;
}

// Evaluated once at server startup — fails fast if required vars are absent.
export const config = loadConfig();
