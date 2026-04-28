import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "session.jsonl");
const MAX_EVENT_BYTES = 16 * 1024;

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "bad shape" }, { status: 400 });
  }

  const enriched = { ts: new Date().toISOString(), ...body };
  const line = JSON.stringify(enriched);
  if (line.length > MAX_EVENT_BYTES) {
    return NextResponse.json({ ok: false, error: "too large" }, { status: 413 });
  }

  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, line + "\n", "utf8");
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "write failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
