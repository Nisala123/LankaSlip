import sharp from "sharp";
import { putObject } from "@/server/storage";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

export async function storeLogo(file: File) {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Upload a JPG, PNG, or WebP logo");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Logo must be 2 MB or smaller");
  }

  const input = Buffer.from(await file.arrayBuffer());
  const body = await sharp(input)
    .rotate()
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .png({ quality: 90 })
    .toBuffer();

  return putObject({
    body,
    contentType: "image/png",
    prefix: "logos",
    ext: "png",
  });
}
