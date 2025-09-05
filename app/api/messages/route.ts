import { NextRequest, NextResponse } from "next/server";
import { addMessage, getMessages, getThread, setLastImage } from "@/lib/store";
import { getOrCreateSessionId } from "@/lib/session";
import { generateOrEditImage, generateVideo } from "@/lib/gemini";
import { enforcePng1024, TARGET_SIZE } from "@/lib/image";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sid = await getOrCreateSessionId();
  const url = new URL(req.url);
  const threadId = url.searchParams.get("thread") || "default";
  console.log(`📥 GET messages - Session: ${sid}, Thread: ${threadId}`);
  const msgs = getMessages(sid, threadId);
  console.log(`📤 Returning ${msgs.length} messages for thread ${threadId}`);
  return NextResponse.json({ thread: threadId, messages: msgs });
}

export async function POST(req: NextRequest) {
  const sid = await getOrCreateSessionId();

  let prompt = "";
  let uploadBuffer: Buffer | null = null;
  // optional user-provided base image
  let themeName: string | undefined;
  let modelId: string | undefined;
  let threadId: string = "default";

  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const m = form.get("message");
      prompt = typeof m === "string" ? m : "";
      const file = form.get("file") as File | null;
      if (file instanceof File) {
        const arrayBuf = await file.arrayBuffer();
        uploadBuffer = Buffer.from(arrayBuf);
      }
      const theme = form.get("theme");
      if (typeof theme === "string" && theme.trim()) {
        themeName = theme.trim();
      }
      const model = form.get("model");
      if (typeof model === "string" && model.trim()) {
        modelId = model.trim();
      }
      const thread = form.get("thread");
      if (typeof thread === "string" && thread.trim()) {
        threadId = thread.trim();
      }
    } else {
      const body = await req.json();
      prompt = body?.message || "";
      if (typeof body?.theme === "string" && body.theme.trim()) {
        themeName = body.theme.trim();
      }
      if (typeof body?.model === "string" && body.model.trim()) {
        modelId = body.model.trim();
      }
      if (typeof body?.thread === "string" && body.thread.trim()) {
        threadId = body.thread.trim();
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Invalid request: ${msg}` }, { status: 400 });
  }

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  // Record user message
  const userMsg = {
    id: `${Date.now()}-u`,
    role: "user" as const,
    text: prompt,
    timestamp: Date.now(),
  };
  addMessage(sid, threadId, userMsg);

  // Determine base image: uploaded or theme or last in this thread
  const threadState = getThread(sid, threadId);
  
  // Debug logging to verify thread state
  console.log(`🔍 Thread ${threadId} state:`, {
    hasLastImage: !!threadState.lastImage,
    lastImageSize: threadState.lastImage?.length || 0,
    lastImageMime: threadState.lastImageMime,
    messageCount: threadState.messages.length
  });
  
  const normalizedUpload = uploadBuffer ? await enforcePng1024(uploadBuffer) : null;

  // Optional theme image from public/themes
  let themeBuffer: Buffer | null = null;
  if (themeName) {
    try {
      const themesDir = path.join(process.cwd(), "public", "themes");
      const safeName = path.basename(themeName);
      const themePath = path.join(themesDir, safeName);
      const stat = await fs.promises.stat(themePath);
      if (stat.isFile()) {
        const raw = await fs.promises.readFile(themePath);
        themeBuffer = await enforcePng1024(raw);
      }
    } catch {
      // ignore invalid theme
      themeBuffer = null;
    }
  }

  // Precedence: upload > theme > lastImage
  const baseImage = normalizedUpload
    ? { data: normalizedUpload, mimeType: "image/png" }
    : themeBuffer
    ? { data: themeBuffer, mimeType: "image/png" }
    : threadState.lastImage
    ? { data: threadState.lastImage, mimeType: threadState.lastImageMime || "image/png" }
    : null;

  // Debug logging for base image selection
  console.log(`🎯 Base image selection for thread ${threadId}:`, {
    hasUpload: !!normalizedUpload,
    hasTheme: !!themeBuffer,
    hasLastImage: !!threadState.lastImage,
    selectedSource: normalizedUpload ? 'upload' : themeBuffer ? 'theme' : threadState.lastImage ? 'lastImage' : 'none',
    baseImageSize: baseImage?.data?.length || 0
  });

  try {
    const isVideoModel = modelId === "veo-3";
    
    if (isVideoModel) {
      // Generate video with Veo 3
      const { video } = await generateVideo({
        prompt,
        baseImage,
        modelId,
      });

      // Persist video to public folder
      const dir = path.join(process.cwd(), "public", "outputs", sid);
      await fs.promises.mkdir(dir, { recursive: true });
      const filename = `${Date.now()}.mp4`;
      const filepath = path.join(dir, filename);
      await fs.promises.writeFile(filepath, video);
      const relUrl = `/outputs/${sid}/${filename}`;

      const assistantMsg = {
        id: `${Date.now()}-a`,
        role: "assistant" as const,
        videoUrl: relUrl,
        timestamp: Date.now(),
      };
      addMessage(sid, threadId, assistantMsg);

      return NextResponse.json({ thread: threadId, message: assistantMsg });
    } else {
      // Generate image with Gemini Image
      const { image } = await generateOrEditImage({
        prompt,
        baseImage,
        size: { width: TARGET_SIZE, height: TARGET_SIZE },
        modelId,
      });

      // Enforce 1024x1024 PNG
      const png = await enforcePng1024(image);

      // Persist to public folder
      const dir = path.join(process.cwd(), "public", "outputs", sid);
      await fs.promises.mkdir(dir, { recursive: true });
      const filename = `${Date.now()}.png`;
      const filepath = path.join(dir, filename);
      await fs.promises.writeFile(filepath, png);
      const relUrl = `/outputs/${sid}/${filename}`;

      // Update thread state
      setLastImage(sid, threadId, png, "image/png");

      const assistantMsg = {
        id: `${Date.now()}-a`,
        role: "assistant" as const,
        imageUrl: relUrl,
        timestamp: Date.now(),
      };
      addMessage(sid, threadId, assistantMsg);

      return NextResponse.json({ thread: threadId, message: assistantMsg });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const assistantMsg = {
      id: `${Date.now()}-a-err`,
      role: "assistant" as const,
      text: `Error: ${msg}`,
      timestamp: Date.now(),
    };
    addMessage(sid, threadId, assistantMsg);
    return NextResponse.json({ error: assistantMsg.text }, { status: 500 });
  }
}
