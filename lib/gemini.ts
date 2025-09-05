// Adapter for Google Generative Language API (Gemini Image & Video)

export type GenerateImageParams = {
  prompt: string;
  baseImage?: { data: Buffer; mimeType: string } | null;
  size?: { width: number; height: number };
  modelId?: string;
};

export type GenerateImageResult = {
  image: Buffer;
  mimeType: string; // e.g., image/png
};

export type GenerateVideoParams = {
  prompt: string;
  baseImage?: { data: Buffer; mimeType: string } | null;
  modelId?: string;
};

export type GenerateVideoResult = {
  video: Buffer;
  mimeType: string; // e.g., video/mp4
};

// Model IDs for different Gemini models
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image-preview";
export const VEO_3_MODEL = process.env.VEO_3_MODEL || "veo-3";

// System prompts for different model types
export const IMAGE_SYSTEM_PROMPT = `You are a logo-generation assistant using Gemini 2.5 Flash Image.
Always generate or edit a single logo at exactly 1024x1024 pixels.
Prioritize simple, high-contrast, scalable vector-like aesthetics with clean silhouettes and minimal shapes.
Maintain the existing composition unless the user explicitly requests a redesign.
If the user asks for an edit, treat the previous image as the base and apply the change.
Never output non-1024x1024 images.`;

export const VIDEO_SYSTEM_PROMPT = `You are a video-generation assistant using Veo 3.
Generate high-quality videos with synchronized audio based on the user's description.
Create cinematic content with realistic physics and smooth motion.
Keep videos engaging and professionally produced.
If provided with an image, use it as the starting frame for the video generation.`;

const API_BASE = process.env.GOOGLE_API_BASE || "https://generativelanguage.googleapis.com";

function assertEnv() {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("Missing GOOGLE_API_KEY in environment");
  }
}

// Minimal adapter over Google Generative Language REST API for image output
// Uses generateContent on an image-capable model; parses inline_data image parts
export async function generateOrEditImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  assertEnv();

  const { prompt, baseImage, modelId } = params;

  const model =
    (modelId && /gemini/i.test(modelId) ? modelId : GEMINI_IMAGE_MODEL) || GEMINI_IMAGE_MODEL;
  const url = `${API_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GOOGLE_API_KEY!)}`;

  type UserPart =
    | { text: string }
    | { inline_data: { mime_type: string; data: string } };
  const userParts: UserPart[] = [];
  if (baseImage?.data) {
    userParts.push({
      inline_data: {
        mime_type: baseImage.mimeType || "image/png",
        data: baseImage.data.toString("base64"),
      },
    });
  }
  userParts.push({ text: prompt });

  // The API currently does not accept image mime types in response_mime_type.
  // We enforce 1024x1024 via system prompt and server-side sharp post-processing.
  // Keep config minimal to avoid validation errors.
  const generationConfig: Record<string, unknown> | undefined = undefined;

  const body: Record<string, unknown> = {
    system_instruction: {
      role: "system",
      parts: [{ text: IMAGE_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: userParts,
      },
    ],
  };
  if (generationConfig) (body as Record<string, unknown>)["generation_config"] = generationConfig;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const json: unknown = await res.json();

  function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
  }

  // Try to find an image in candidates parts
  if (isRecord(json)) {
    const candidates = isRecord(json) && Array.isArray(json["candidates"]) ? (json["candidates"] as unknown[]) : [];
    for (const c of candidates) {
      if (!isRecord(c)) continue;
      const content = c["content"];
      if (!isRecord(content)) continue;
      const parts = Array.isArray(content["parts"]) ? (content["parts"] as unknown[]) : [];
      for (const p of parts) {
        if (!isRecord(p)) continue;
        const inline = (p["inline_data"] ?? p["inlineData"] ?? p["file_data"] ?? p["fileData"]) as unknown;
        if (isRecord(inline) && typeof inline["data"] === "string") {
          const mime = typeof inline["mime_type"] === "string" ? (inline["mime_type"] as string) : typeof inline["mimeType"] === "string" ? (inline["mimeType"] as string) : "image/png";
          const buffer = Buffer.from(inline["data"] as string, "base64");
          return { image: buffer, mimeType: mime };
        }
        const text = p["text"];
        if (typeof text === "string" && text.startsWith("data:image/")) {
          const m = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
          if (m) {
            return { image: Buffer.from(m[2], "base64"), mimeType: m[1] };
          }
        }
      }
    }
  }

  // If no image part, attempt to read a top-level images array (experimental)
  if (isRecord(json)) {
    const images = Array.isArray(json["images"]) ? (json["images"] as unknown[]) : [];
    const first = images[0];
    if (isRecord(first) && typeof first["data"] === "string") {
      const mime = typeof first["mime_type"] === "string" ? (first["mime_type"] as string) : "image/png";
      return {
        image: Buffer.from(first["data"] as string, "base64"),
        mimeType: mime,
      };
    }
  }

  throw new Error("Gemini did not return an image payload");
}

// Video generation function for Veo 3
export async function generateVideo(params: GenerateVideoParams): Promise<GenerateVideoResult> {
  assertEnv();

  const { prompt, baseImage, modelId } = params;

  const model = modelId && modelId === "veo-3" ? VEO_3_MODEL : VEO_3_MODEL;
  const url = `${API_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GOOGLE_API_KEY!)}`;

  type UserPart =
    | { text: string }
    | { inline_data: { mime_type: string; data: string } };
  const userParts: UserPart[] = [];
  
  if (baseImage?.data) {
    userParts.push({
      inline_data: {
        mime_type: baseImage.mimeType || "image/png",
        data: baseImage.data.toString("base64"),
      },
    });
  }
  userParts.push({ text: prompt });

  const body: Record<string, unknown> = {
    system_instruction: {
      role: "system",
      parts: [{ text: VIDEO_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: userParts,
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Veo 3 API error ${res.status}: ${text}`);
  }

  const json: unknown = await res.json();

  function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
  }

  // Try to find a video in candidates parts
  if (isRecord(json)) {
    const candidates = isRecord(json) && Array.isArray(json["candidates"]) ? (json["candidates"] as unknown[]) : [];
    for (const c of candidates) {
      if (!isRecord(c)) continue;
      const content = c["content"];
      if (!isRecord(content)) continue;
      const parts = Array.isArray(content["parts"]) ? (content["parts"] as unknown[]) : [];
      for (const p of parts) {
        if (!isRecord(p)) continue;
        const inline = (p["inline_data"] ?? p["inlineData"] ?? p["file_data"] ?? p["fileData"]) as unknown;
        if (isRecord(inline) && typeof inline["data"] === "string") {
          const mime = typeof inline["mime_type"] === "string" ? (inline["mime_type"] as string) : typeof inline["mimeType"] === "string" ? (inline["mimeType"] as string) : "video/mp4";
          const buffer = Buffer.from(inline["data"] as string, "base64");
          return { video: buffer, mimeType: mime };
        }
      }
    }
  }

  throw new Error("Veo 3 did not return a video payload");
}
