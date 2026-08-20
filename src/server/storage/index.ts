import { createReadStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

const LOCAL_ROOT = path.join(process.cwd(), "data", "uploads");

function r2Enabled() {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID) &&
      process.env.R2_BUCKET,
  );
}

function r2Client() {
  const endpoint =
    process.env.R2_ENDPOINT ??
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function putObject(input: {
  body: Buffer;
  contentType: string;
  prefix: string;
  ext: string;
}) {
  const key = `${input.prefix}/${nanoid()}.${input.ext}`;
  if (r2Enabled()) {
    await r2Client().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return { key, driver: "r2" as const };
  }

  const full = path.join(LOCAL_ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, input.body);
  return { key, driver: "local" as const };
}

export async function getSignedReadUrl(key: string, expiresIn = 600) {
  if (r2Enabled()) {
    return getSignedUrl(
      r2Client(),
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
      }),
      { expiresIn },
    );
  }
  return null;
}

export function localObjectPath(key: string) {
  const full = path.resolve(LOCAL_ROOT, key);
  if (!full.startsWith(path.resolve(LOCAL_ROOT))) {
    throw new Error("Invalid object key");
  }
  if (!existsSync(full)) {
    return null;
  }
  return full;
}

export function streamLocalObject(key: string) {
  const full = localObjectPath(key);
  if (!full) return null;
  return createReadStream(full);
}
