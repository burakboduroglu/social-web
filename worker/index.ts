import { handleApi } from "../server/api";

// Cloudflare Worker entry. Static files come from the assets binding, so the
// worker only owns the API routes; wrangler routes /api/* here first.
type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  HYPERDRIVE?: { connectionString: string };
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Hyperdrive performs the TLS handshake to Supabase's private CA, which the
    // Workers socket API cannot verify on its own. It hands the app a trusted
    // connection string that the Postgres client can use as-is.
    if (env.HYPERDRIVE) {
      process.env.DATABASE_URL = env.HYPERDRIVE.connectionString;
      // Hyperdrive terminates TLS at the edge; its internal hop is plaintext.
      process.env.DATABASE_SSL = "disable";
    }
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request);
    return env.ASSETS.fetch(request);
  },
};
