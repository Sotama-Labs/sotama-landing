import { Pool } from "pg";
import { promises as fs } from "node:fs";
import path from "node:path";

type Entry = { email: string; ts: number; ref?: string };

// Cache a single pool (+ its schema-init) per warm Lambda instance.
const cache = ((globalThis as unknown as {
  __sotamaPg?: { pool: Pool | null; ready: Promise<Pool | null> | null };
}).__sotamaPg ??= { pool: null, ready: null });

function findDatabaseUrl(): string | null {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    null
  );
}

// Managed providers (Neon, Supabase) require TLS; local Postgres doesn't.
function needsSsl(url: string): boolean {
  if (/sslmode=disable/.test(url)) return false;
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

async function getPool(): Promise<Pool | null> {
  if (cache.pool) return cache.pool;
  if (cache.ready) return cache.ready;
  const url = findDatabaseUrl();
  if (!url) return null;

  cache.ready = (async () => {
    const pool = new Pool({
      connectionString: url,
      max: 3,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      // Neon/Supabase present publicly-trusted certs — verify them (no MITM).
      ssl: needsSsl(url) ? { rejectUnauthorized: true } : undefined,
    });
    pool.on("error", (err) => console.error("[pg] pool error", err));
    await pool.query(
      `CREATE TABLE IF NOT EXISTS waitlist (
         email text PRIMARY KEY,
         ref   text,
         ts    timestamptz NOT NULL DEFAULT now()
       )`,
    );
    cache.pool = pool;
    return pool;
  })();

  try {
    return await cache.ready;
  } catch (err) {
    cache.ready = null; // let the next request retry after a transient failure
    throw err;
  }
}

export function diagnostics() {
  const seen: string[] = [];
  const interesting = /^(DATABASE_|POSTGRES_|PG)/;
  for (const k of Object.keys(process.env)) {
    if (interesting.test(k)) seen.push(k);
  }
  const url = findDatabaseUrl();
  let host: string | null = null;
  if (url) {
    try {
      host = new URL(url).host; // host:port only — never credentials
    } catch {
      host = "unparseable";
    }
  }
  return {
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    vercelEnv: process.env.VERCEL_ENV ?? "unset",
    region: process.env.VERCEL_REGION ?? "unset",
    databaseUrlPresent: !!url,
    databaseHost: host,
    seenEnvVarNames: seen.sort(),
  };
}

const LOCAL_FILE = path.join(process.cwd(), ".waitlist.local.json");

async function readLocal(): Promise<Entry[]> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocal(entries: Entry[]): Promise<void> {
  await fs.writeFile(LOCAL_FILE, JSON.stringify(entries, null, 2), "utf8");
}

export type AddResult = { added: boolean; count: number };

export async function addEmail(email: string, ref?: string): Promise<AddResult> {
  const normalized = email.trim().toLowerCase();
  const pool = await getPool();

  if (pool) {
    const insert = await pool.query(
      `INSERT INTO waitlist (email, ref) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [normalized, ref ?? null],
    );
    const { rows } = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM waitlist",
    );
    return { added: insert.rowCount === 1, count: Number(rows[0]?.n ?? 0) };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "No DATABASE_URL / POSTGRES_URL in environment. Connect a Postgres database in the Vercel dashboard (Storage → Create Database → Neon) and redeploy.",
    );
  }

  const entries = await readLocal();
  const exists = entries.some((e) => e.email === normalized);
  if (!exists) {
    entries.unshift({ email: normalized, ts: Date.now(), ref });
    await writeLocal(entries);
  }
  return { added: !exists, count: entries.length };
}

export async function getCount(): Promise<number> {
  const pool = await getPool();
  if (pool) {
    const { rows } = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM waitlist",
    );
    return Number(rows[0]?.n ?? 0);
  }
  const entries = await readLocal();
  return entries.length;
}
