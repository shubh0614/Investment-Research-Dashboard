// Called once by Next.js at server startup (both dev and production).
// Importing config here triggers the Zod validation; the process exits
// with a clear message if any required env var is absent.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/config");
  }
}
