import sharp from "sharp";

export const TARGET_SIZE = 1024;

export async function enforcePng1024(input: Buffer): Promise<Buffer> {
  const img = sharp(input, { limitInputPixels: false });
  const meta = await img.metadata();
  const width = meta.width ?? TARGET_SIZE;
  const height = meta.height ?? TARGET_SIZE;

  if (width === TARGET_SIZE && height === TARGET_SIZE && (meta.format === "png")) {
    // Already correct size and PNG
    return input;
  }

  // Center-crop to square before resizing to avoid distortion
  const size = Math.min(width, height);
  const left = Math.max(0, Math.floor((width - size) / 2));
  const top = Math.max(0, Math.floor((height - size) / 2));

  const output = await img
    .extract({ left, top, width: size, height: size })
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  return output;
}

