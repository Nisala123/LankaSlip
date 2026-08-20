import sharp from "sharp";
import { putObject } from "@/server/storage";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function storeSlip(file: File) {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Upload a JPG, PNG, or WebP image");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Slip must be 5 MB or smaller");
  }

  const input = Buffer.from(await file.arrayBuffer());
  const body = await sharp(input).rotate().jpeg({ quality: 84 }).toBuffer();
  return putObject({
    body,
    contentType: "image/jpeg",
    prefix: "slips",
    ext: "jpg",
  });
}

export async function readObjectBuffer(key: string) {
  const { localObjectPath, getSignedReadUrl } = await import("@/server/storage");
  const local = localObjectPath(key);
  if (local) {
    const { readFile } = await import("node:fs/promises");
    return readFile(local);
  }
  const url = await getSignedReadUrl(key, 60);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
