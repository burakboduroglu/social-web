import postgres from "postgres";
import { Client } from "pg";
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
function hyperdrive() {
  return process.env.DATABASE_SSL === "disable";
}
function connect(): Database {
  // Direct Supavisor transaction mode cannot use prepared statements.
  // The Worker never uses this client; Hyperdrive opens a pg client per call.
  if (hyperdrive()) throw new Error("Hyperdrive connections are per request. Use withDatabase().");
  const client = postgres(databaseUrl(), { prepare: false, ssl: "require", max: 5, connect_timeout: 10, idle_timeout: 20 });
  return drizzle(client, { schema });
}
export function getDatabase() {
  const key = databaseUrl();
  if (!database || databaseKey !== key) {
    const previous = database as (Database & { $client?: { end: () => Promise<unknown> } }) | undefined;
    database = connect();
    databaseKey = key;
    if (previous) void previous.$client?.end();
  }
  return database;
}
// A Worker isolate freezes with its sockets open. A shared pg pool therefore
// keeps Hyperdrive origin slots checked out until the pool is full and later
// requests fail. Each Hyperdrive call opens one client and closes it before
// returning. postgres.js stays cached for local and script connections.
export async function withDatabase<T>(run: (db: Database) => Promise<T>): Promise<T> {
  if (!hyperdrive()) return run(getDatabase());
  const client = new Client({ connectionString: databaseUrl(), ssl: false, connectionTimeoutMillis: 8_000 });
  await client.connect();
  try {
    return await run(drizzlePg(client, { schema }) as unknown as Database);
  } finally {
    await client.end().catch(() => undefined);
  }
}
export type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

// The pooler connection is privileged. Every application query MUST run here.
// LOCAL settings are scoped to this transaction and cannot leak across users.
export async function withUser<T>(userId: string, callback: (tx: Transaction) => Promise<T>) {
  return withDatabase(db => db.transaction(async tx => {
    await applyUserContext(tx, userId);
    return callback(tx);
  }));
}

export async function applyUserContext(tx: { execute(query: SQL): Promise<unknown> }, userId: string) {
  await tx.execute(sql`select
    set_config('request.jwt.claim.sub', ${userId}, true),
    set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);
}
