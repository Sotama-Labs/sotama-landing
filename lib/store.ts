import { Redis } from "@upstash/redis";
import { promises as fs } from "node:fs";
import path from "node:path";

const KEY_SET = "sotama:waitlist:emails";
const KEY_LIST = "sotama:waitlist:entries";

type Entry = { email: string; ts: number; ref?: string };

function getRedis(): Redis | null {
  // Vercel marketplace integration injects KV_REST_API_URL/TOKEN.
  // The @upstash/redis SDK also accepts UPSTASH_REDIS_* — support both.
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
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
  const redis = getRedis();

  if (redis) {
    const added = await redis.sadd(KEY_SET, normalized);
    if (added) {
      const entry: Entry = { email: normalized, ts: Date.now(), ref };
      await redis.lpush(KEY_LIST, JSON.stringify(entry));
    }
    const count = await redis.scard(KEY_SET);
    return { added: added === 1, count: Number(count) };
  }

  // Local dev fallback — file-backed.
  const entries = await readLocal();
  const exists = entries.some((e) => e.email === normalized);
  if (!exists) {
    entries.unshift({ email: normalized, ts: Date.now(), ref });
    await writeLocal(entries);
  }
  return { added: !exists, count: entries.length };
}

export async function getCount(): Promise<number> {
  const redis = getRedis();
  if (redis) {
    const c = await redis.scard(KEY_SET);
    return Number(c);
  }
  const entries = await readLocal();
  return entries.length;
}
