import postgres from "postgres";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { sql, type SQL } from "drizzle-orm";
import * as schema from "./schema";

export function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("[YOUR-PASSWORD]")) throw new Error("DATABASE_URL requires the Supabase database password.");
  return url;
}
// Query call sites are written against postgres.js. The Hyperdrive client is
// the same Drizzle API backed by node-postgres.
type Database = ReturnType<typeof drizzle<typeof schema>>;
let database: Database | undefined;
let databaseKey = "";
function connect(): Database {
  // The Worker reaches Postgres through Hyperdrive and sets DATABASE_SSL=disable
  // because that hop is plaintext. Hyperdrive's transaction pool drops the extra
  // type-lookup messages postgres.js sends when prepared statements are off,
  // and Drizzle always uses that path. node-postgres speaks the protocol
  // Hyperdrive accepts. Direct Supabase pooler connections stay on postgres.js
  // with prepared statements disabled.
  if (process.env.DATABASE_SSL === "disable") {
    const pool = new Pool({ connectionString: databaseUrl(), ssl: false, max: 1, connectionTimeoutMillis: 8_000, idleTimeoutMillis: 5_000 });
    return drizzlePg(pool, { schema }) as unknown as Database;
  }
  const client = postgres(databaseUrl(), { prepare: false, ssl: "require", max: 5, connect_timeout: 10, idle_timeout: 20 });
  return drizzle(client, { schema });
}
export function getDatabase() {
  const key = `${process.env.DATABASE_SSL ?? "require"}\n${databaseUrl()}`;
  if (!database || databaseKey !== key) {
    const previous = database as (Database & { $client?: { end: () => Promise<unknown> } }) | undefined;
    database = connect();
    databaseKey = key;
    if (previous) void previous.$client?.end();
  }
  return database;
}
export type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

// The pooler connection is privileged. Every application query MUST run here.
// LOCAL settings are scoped to this transaction and cannot leak across users.
export async function withUser<T>(userId: string, callback: (tx: Transaction) => Promise<T>) {
  return getDatabase().transaction(async tx => {
    await applyUserContext(tx, userId);
    return callback(tx);
  });
}

export async function applyUserContext(tx: { execute(query: SQL): Promise<unknown> }, userId: string) {
  await tx.execute(sql`select
    set_config('request.jwt.claim.sub', ${userId}, true),
    set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);
}
