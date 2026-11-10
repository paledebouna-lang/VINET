import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export const photoPath = (id: string, small = false) =>
  path.join(UPLOAD_DIR, `${id}${small ? "-s" : ""}.webp`);

/**
 * Re-encodes an upload instead of storing it as sent: this proves the file is an image,
 * drops EXIF data (phone photos carry the GPS position of the seller's home) and bounds its size.
 * Throws when the file is not a readable image.
 */
async function encode(file: File) {
  const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 }).rotate();
  const fit = { fit: "inside", withoutEnlargement: true } as const;
  return {
    large: await input.clone().resize(1600, 1600, fit).webp({ quality: 80 }).toBuffer(),
    small: await input.clone().resize(480, 480, fit).webp({ quality: 70 }).toBuffer(),
  };
}

/** Stores the photos and returns their ids in order. Throws, leaving nothing behind, if one is unreadable. */
export async function storePhotos(files: File[]) {
  const encoded = await Promise.all(files.map(encode));
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ids = encoded.map(() => crypto.randomUUID());
  await Promise.all(
    encoded.flatMap((photo, i) => [
      writeFile(photoPath(ids[i]), photo.large),
      writeFile(photoPath(ids[i], true), photo.small),
    ]),
  );
  return ids;
}

export async function deletePhotos(ids: string[]) {
  await Promise.all(ids.flatMap((id) => [rm(photoPath(id), { force: true }), rm(photoPath(id, true), { force: true })]));
}
