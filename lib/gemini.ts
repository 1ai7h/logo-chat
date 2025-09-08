// Adapter for Google Generative Language API (Gemini Image & Video)

export type GenerateImageParams = {
  prompt: string;
  baseImage?: { data: Buffer; mimeType: string } | null;
  size?: { width: number; height: number };
  modelId?: string;
  templateId?: string;
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
export const VEO_3_MODEL = process.env.VEO_3_MODEL || "veo-3.0-generate-preview";

// Prompt templates for different use cases
export const PROMPT_TEMPLATES = {
  logo: {
    name: "Logo Design",
    prompt: `You are a logo-generation assistant using Gemini 2.5 Flash Image.
Always generate or edit a single logo at exactly 1024x1024 pixels.
Prioritize simple, high-contrast, scalable vector-like aesthetics with clean silhouettes and minimal shapes.
Maintain the existing composition unless the user explicitly requests a redesign.
If the user asks for an edit, treat the previous image as the base and apply the change.
Never output non-1024x1024 images.`,
    icon: "🎨"
  },
  general: {
    name: "General Images",
    prompt: `You are an image generation assistant using Gemini 2.5 Flash Image.
Generate high-quality, detailed images at exactly 1024x1024 pixels.
Focus on photorealistic quality, rich details, and vibrant colors.
If the user asks for an edit, treat the previous image as the base and apply the change.
Create visually stunning and accurate representations of the user's request.
Never output non-1024x1024 images.`,
    icon: "🖼️"
  },
  artistic: {
    name: "Artistic Images",
    prompt: `You are an artistic image generation assistant using Gemini 2.5 Flash Image.
Create artistic, stylized images at exactly 1024x1024 pixels.
Focus on creative interpretations, unique art styles, and expressive visuals.
Emphasize artistic techniques like painting, illustration, digital art, or mixed media styles.
If the user asks for an edit, treat the previous image as the base and apply the change.
Never output non-1024x1024 images.`,
    icon: "🎭"
  },
  product: {
    name: "Product Images",
    prompt: `You are a product photography assistant using Gemini 2.5 Flash Image.
Generate clean, professional product images at exactly 1024x1024 pixels.
Focus on clear, well-lit product shots with clean backgrounds.
Emphasize product details, textures, and commercial appeal.
If the user asks for an edit, treat the previous image as the base and apply the change.
Never output non-1024x1024 images.`,
    icon: "📦"
  },
  portrait: {
    name: "Portrait & Character",
    prompt: `You are a portrait generation assistant using Gemini 2.5 Flash Image.
Generate detailed portraits and character images at exactly 1024x1024 pixels.
Focus on facial features, expressions, and character design.
Emphasize realistic proportions, lighting, and emotional depth.
If the user asks for an edit, treat the previous image as the base and apply the change.
Never output non-1024x1024 images.`,
    icon: "👤"
  },
  landscape: {
    name: "Landscapes & Scenes",
    prompt: `You are a landscape and scene generation assistant using Gemini 2.5 Flash Image.
Generate beautiful landscapes, cityscapes, and environmental scenes at exactly 1024x1024 pixels.
Focus on composition, atmospheric effects, and scenic beauty.
Emphasize depth, lighting, and environmental storytelling.
If the user asks for an edit, treat the previous image as the base and apply the change.
Never output non-1024x1024 images.`,
    icon: "🏞️"
  }
};

export const VIDEO_SYSTEM_PROMPT = `You are a video-generation assistant using Veo 3.
Generate high-quality videos with synchronized audio based on the user's description.
Create cinematic content with realistic physics and smooth motion.
Keep videos engaging and professionally produced.
If provided with an image, use it as the starting frame for the video generation.`;

// Helper function to get system prompt based on model and template
export function getSystemPrompt(modelId?: string, templateId?: string): string {
  if (modelId === "veo-3.0-generate-preview") {
    return VIDEO_SYSTEM_PROMPT;
  }
  
  if (templateId && PROMPT_TEMPLATES[templateId as keyof typeof PROMPT_TEMPLATES]) {
    return PROMPT_TEMPLATES[templateId as keyof typeof PROMPT_TEMPLATES].prompt;
  }
  
  // Default to logo prompt for backward compatibility
  return PROMPT_TEMPLATES.logo.prompt;
}

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

  const { prompt, baseImage, modelId, templateId } = params;

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
      parts: [{ text: getSystemPrompt(modelId, templateId) }],
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

  const { prompt, baseImage } = params;

  console.log('🎬 Starting Veo 3 video generation...');

  // Use the correct Veo 3 model name and endpoint as per the documentation
  const model = "veo-3.0-generate-preview";
  const url = `${API_BASE}/v1beta/models/${encodeURIComponent(model)}:generateVideos?key=${encodeURIComponent(process.env.GOOGLE_API_KEY!)}`;

  const body: Record<string, unknown> = {
    prompt: prompt,
    config: {
      // Optional negative prompts - can be configured per the documentation
      negative_prompt: "blurry, low quality, distorted",
    }
  };

  // Add base image if provided (for image-to-video generation)
  if (baseImage?.data) {
    body.base_image = {
      mime_type: baseImage.mimeType || "image/png",
      data: baseImage.data.toString("base64"),
    };
    console.log('🖼️ Using base image for video generation');
  }

  console.log('📤 Sending request to Veo 3 API...');

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('❌ Veo 3 API error:', res.status, text);
    throw new Error(`Veo 3 API error ${res.status}: ${text}`);
  }

  const json: unknown = await res.json();
  console.log('✅ Received response from Veo 3 API');

  function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
  }

  // The response is an operation object that needs to be polled
  if (isRecord(json) && typeof json.name === "string") {
    const operationName = json.name;
    console.log('⏳ Polling operation:', operationName);
    
    // Poll the operation until it's complete - videos can take 1-3 minutes
    const maxAttempts = 40; // ~3 minutes with 5-second intervals
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const checkUrl = `${API_BASE}/v1beta/operations/${encodeURIComponent(operationName)}?key=${encodeURIComponent(process.env.GOOGLE_API_KEY!)}`;
      const checkRes = await fetch(checkUrl);
      
      if (!checkRes.ok) {
        console.error('❌ Operation check failed:', checkRes.status);
        throw new Error(`Operation check failed: ${checkRes.status}`);
      }
      
      const checkJson: unknown = await checkRes.json();
      
      if (isRecord(checkJson)) {
        console.log(`🔄 Polling attempt ${attempt + 1}/${maxAttempts}, done: ${checkJson.done}`);
        
        if (checkJson.done === true) {
          console.log('🎉 Video generation completed!');
          // Operation complete, extract the video
          const result = checkJson.result;
          if (isRecord(result) && Array.isArray(result.generated_videos)) {
            const firstVideo = result.generated_videos[0];
            if (isRecord(firstVideo) && isRecord(firstVideo.video)) {
              // The video should have file info for download
              const videoFile = firstVideo.video;
              if (typeof videoFile.uri === "string") {
                console.log('📥 Downloading video from URI...');
                const videoRes = await fetch(videoFile.uri);
                if (videoRes.ok) {
                  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
                  console.log('✅ Video downloaded successfully, size:', videoBuffer.length, 'bytes');
                  return { video: videoBuffer, mimeType: "video/mp4" };
                } else {
                  throw new Error(`Failed to download video: ${videoRes.status}`);
                }
              }
            }
          }
          throw new Error("Video generation completed but no video found in response");
        }
        
        // Check for errors
        if (checkJson.error) {
          console.error('❌ Veo 3 generation error:', checkJson.error);
          throw new Error(`Veo 3 generation failed: ${JSON.stringify(checkJson.error)}`);
        }
      }
    }
    
    throw new Error("Veo 3 video generation timed out after 3+ minutes");
  }

  console.error('❌ Invalid response from Veo 3:', json);
  throw new Error("Veo 3 did not return a valid operation");
}
