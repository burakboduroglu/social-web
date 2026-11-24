# Deployment

The web app ships as a Cloudflare Worker with static assets, and the API runs in
the same Worker. The database is Supabase Postgres reached through Hyperdrive.

## Why Hyperdrive

Supabase signs its Postgres certificates with the private "Supabase Root 2021 CA".
The Workers socket API always verifies server certificates and has no
`rejectUnauthorized` or custom-CA option, so a direct connection from a Worker
fails the TLS handshake. Hyperdrive terminates that connection inside Cloudflare
and gives the Worker a connection string it can trust.

The Worker sets `DATABASE_SSL=disable` for that hop, and `server/db/client.ts` uses
a node-postgres client for that call only, then closes it. A shared pool survives
a frozen Worker isolate and holds Hyperdrive's origin slots until later requests
fail with HTTP 503. `postgres.js` is also unsuitable here: with prepared
statements disabled, Drizzle sends type-lookup messages that Hyperdrive's
transaction pool drops, and those hung connections fill the same slots. Direct
Supavisor connections stay on `postgres.js` with prepared statements disabled.

Hyperdrive pools connections itself, so its origin must be Supabase's **session
pooler on port 5432**, not the transaction pooler on 6543. Supavisor in
transaction mode rejects Hyperdrive's multiplexed connections with
`58000 Tried to recycle a connection still in a transaction`, then exhausts the
project pool and answers every API call with
`Timed out while waiting for an open slot in the pool`. `.env` keeps the
transaction pooler for local scripts and tests; only the Hyperdrive configuration
uses session mode.

## Continuous deployment

`.github/workflows/deploy.yml` typechecks, tests, builds and deploys on every push
to `main`, using a Cloudflare API token stored as a repository secret:

| Secret                  | Value                                    |
| ----------------------- | ---------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | API token with **Workers Scripts: Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | `e9bdd743b2850bff64fb314caa934574`        |

Create the token at <https://dash.cloudflare.com/profile/api-tokens> → *Create
Token* → *Edit Cloudflare Workers* template, scoped to the account above, then:

```sh
gh secret set CLOUDFLARE_API_TOKEN --repo burakboduroglu/social-web
gh secret set CLOUDFLARE_ACCOUNT_ID --repo burakboduroglu/social-web
```

Worker secrets and the Hyperdrive binding live in Cloudflare, not in the repo, and
each deploy preserves them. Do not add them to GitHub.

`.github/workflows/ci.yml` runs the same checks on pull requests without deploying.
`bun run worker:deploy` still deploys from a workstation and bypasses both; use it
only for the first deploy or an emergency.

Cloudflare Workers Builds is an alternative to the token: connect the repository
under **Settings → Builds**, set the build command to `bun run build` and the deploy
command to `bunx wrangler deploy`, and pin the build variable `BUN_VERSION=1.4.4`
(the build image default can lag behind the lockfile version). Use one mechanism,
not both, or every push deploys twice.

## One-time setup

1. Log in: `bunx wrangler login`.
2. Store the public Supabase settings:
   ```sh
   bunx wrangler secret put SUPABASE_URL
   bunx wrangler secret put SUPABASE_PUBLISHABLE_KEY
   ```
3. Export the Supabase root CA from the session pooler chain:
   ```sh
   echo | openssl s_client -starttls postgres \
     -connect aws-1-eu-central-1.pooler.supabase.com:5432 \
     -servername aws-1-eu-central-1.pooler.supabase.com -showcerts 2>/dev/null \
     | awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' > supabase-ca.pem
   bunx wrangler cert upload certificate-authority --ca-cert supabase-ca.pem --name supabase-root-2021
   ```
4. Create the Hyperdrive configuration with the **session pooler** connection
   string and the uploaded CA. The direct host is IPv6-only and the transaction
   pooler breaks Hyperdrive's multiplexing, so use port 5432:
   ```sh
   bunx wrangler hyperdrive create social-web \
     --connection-string="postgres://postgres.<ref>:<password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" \
     --sslmode verify-full --ca-certificate-id <ca-id>
   ```
   To repair an existing configuration, repeat the command with
   `bunx wrangler hyperdrive update <id>` and the same flags.
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
