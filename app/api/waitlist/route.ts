import { NextResponse } from "next/server";
import { addEmail, getCount } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export async function GET() {
  const count = await getCount();
  return NextResponse.json({ count });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = (body ?? {}) as { email?: unknown; ref?: unknown; hp?: unknown };

  // Honeypot — silently accept and discard if a bot filled the hidden field.
  if (typeof data.hp === "string" && data.hp.length > 0) {
    return NextResponse.json({ ok: true, count: await getCount() });
  }

  const email = typeof data.email === "string" ? data.email.trim() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email" },
      { status: 400 },
    );
  }

  const ref =
    typeof data.ref === "string" && data.ref.length <= 64 ? data.ref : undefined;

  try {
    const { added, count } = await addEmail(email, ref);
    const res = NextResponse.json({ ok: true, added, count });
    res.cookies.set("sotama_joined", "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    console.error("[waitlist] add failed", err);
    return NextResponse.json(
      { error: "Could not save right now. Try again." },
      { status: 500 },
    );
  }
}
