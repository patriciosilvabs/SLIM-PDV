import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/integrations/firebase/client';

function normalizePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+/g, '/');
}

function toObjectPath(bucket: string, filePath: string): string {
  return `${normalizePath(bucket)}/${normalizePath(filePath)}`;
}

export async function uploadToBucket(params: {
  bucket: string;
  filePath: string;
  file: Blob | Uint8Array | ArrayBuffer;
  contentType?: string;
}): Promise<string> {
  const objectPath = toObjectPath(params.bucket, params.filePath);
  const objectRef = ref(storage, objectPath);
  await uploadBytes(objectRef, params.file as Blob, params.contentType ? { contentType: params.contentType } : undefined);
  return getDownloadURL(objectRef);
}

export async function removeFromBucket(params: { bucket: string; paths: string[] }): Promise<void> {
  for (const filePath of params.paths) {
    const objectPath = toObjectPath(params.bucket, filePath);
    const objectRef = ref(storage, objectPath);
    try {
      await deleteObject(objectRef);
    } catch (error: any) {
// Keep idempotent remove behavior for callers that expect silent success on missing files.
      if (error?.code !== 'storage/object-not-found') {
        throw error;
      }
    }
  }
}

export function extractBucketPathFromUrl(url: string, bucket: string): string | null {
  if (!url) return null;

  // Firebase URL format:
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>?...
  const marker = '/o/';
  if (url.includes(marker)) {
    const encoded = url.split(marker)[1]?.split('?')[0] ?? '';
    if (!encoded) return null;
    const decoded = decodeURIComponent(encoded);
    if (decoded.startsWith(`${bucket}/`)) {
      return decoded.slice(bucket.length + 1);
    }
    return decoded;
  }

// Legacy public URL compatibility format:
  // .../storage/v1/object/public/<bucket>/<path>
  const legacy = `/${bucket}/`;
  if (url.includes(legacy)) {
    return url.split(legacy)[1] ?? null;
  }

  return null;
}
