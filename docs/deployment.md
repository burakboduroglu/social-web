# Deployment

The web app ships as a Cloudflare Worker with static assets, and the API runs in
the same Worker. The database is Supabase Postgres reached through Hyperdrive.

## Why Hyperdrive

Supabase signs its Postgres certificates with the private "Supabase Root 2021 CA".
The Workers socket API always verifies server certificates and has no
`rejectUnauthorized` or custom-CA option, so a direct connection from a Worker
fails the TLS handshake. Hyperdrive terminates that connection inside Cloudflare
and gives the Worker a connection string it can trust.

## One-time setup

1. Log in: `bunx wrangler login`.
2. Store the public Supabase settings:
   ```sh
   bunx wrangler secret put SUPABASE_URL
   bunx wrangler secret put SUPABASE_PUBLISHABLE_KEY
   ```
3. Export the Supabase root CA from the pooler chain:
   ```sh
   echo | openssl s_client -starttls postgres \
     -connect aws-1-eu-central-1.pooler.supabase.com:6543 \
     -servername aws-1-eu-central-1.pooler.supabase.com -showcerts 2>/dev/null \
     | awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' > supabase-ca.pem
   bunx wrangler cert upload certificate-authority --ca-cert supabase-ca.pem --name supabase-root-2021
   ```
4. Create the Hyperdrive configuration with the pooler connection string and the
   uploaded CA. The direct host is IPv6-only, so use the pooler:
   ```sh
   bunx wrangler hyperdrive create social-web \
     --connection-string="postgres://postgres.<ref>:<password>@aws-1-eu-central-1.pooler.supabase.com:6543/postgres" \
     --sslmode verify-full --ca-certificate-id <ca-id>
   ```
5. Add the returned id to `wrangler.jsonc`:
   ```jsonc
   "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<id>" }]
   ```
6. Deploy: `bun run worker:deploy`.

## After the first deploy

- Supabase dashboard → Authentication → URL configuration: set **Site URL** to the
  Worker origin and add it to **Redirect URLs** (`https://<origin>/auth/confirm`).
  Without this, confirmation links point at localhost.
- Cloudflare Turnstile → the widget hostname list must include the Worker origin,
  and Supabase Auth must hold the matching secret. Local development keeps the
  always-pass test pair.
- Check `/api/config` returns the production site key, then run a full sign-up and
  confirmation against the deployed origin.

## Local development

`bun run dev` still runs the Vite app with the Bun API on `127.0.0.1:3001`; that is
the normal loop. `bun run worker:dev` runs the Worker in workerd and needs the
Hyperdrive binding (or a working `localConnectionString`) because a direct
connection from workerd hits the Supabase private CA.
