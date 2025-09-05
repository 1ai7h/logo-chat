import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const themesDir = path.join(process.cwd(), "public", "themes");
  let files: string[] = [];
  try {
    const entries = await fs.promises.readdir(themesDir, { withFileTypes: true });
    files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((n) => /\.(png|jpg|jpeg|webp)$/i.test(n));
  } catch {
    // directory might not exist yet
    files = [];
  }

  const themes = files.map((name) => ({ name, url: `/themes/${name}` }));
  return NextResponse.json({ themes });
}

