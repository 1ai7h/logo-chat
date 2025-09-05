import { NextRequest, NextResponse } from "next/server";
import { cloneThread, createThread, deleteThread } from "@/lib/store";
import { getOrCreateSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sid = await getOrCreateSessionId();
  let source: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.sourceThread === "string" && body.sourceThread.trim()) {
      source = body.sourceThread.trim();
    }
  } catch {}

  console.log(`🔗 Creating thread - Session: ${sid}, Source: ${source}`);
  const thread = source ? cloneThread(sid, source) : createThread(sid);
  console.log(`✅ Thread created: ${thread}`);
  return NextResponse.json({ thread });
}

export async function DELETE(req: NextRequest) {
  const sid = await getOrCreateSessionId();
  let threadId: string | undefined;
  try {
    const url = new URL(req.url);
    threadId = url.searchParams.get("thread") || undefined;
    if (!threadId) {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.thread === "string") threadId = body.thread;
    }
  } catch {}

  if (!threadId) return NextResponse.json({ error: "Missing thread" }, { status: 400 });
  const ok = deleteThread(sid, threadId);
  return NextResponse.json({ ok });
}
