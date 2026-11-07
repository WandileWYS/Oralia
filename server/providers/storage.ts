import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { createHash } from 'node:crypto';
import { required } from '../config.ts';
import { ServiceError } from '../errors.ts';

export function mediaCloud() {
  cloudinary.config({ cloud_name: required('CLOUDINARY_CLOUD_NAME'), api_key: required('CLOUDINARY_API_KEY'), api_secret: required('CLOUDINARY_API_SECRET'), secure: true });
  return cloudinary;
}
export function uploadParameters(publicId: string) {
  const cloud = mediaCloud();
  const parameters = { public_id: publicId, timestamp: Math.floor(Date.now()/1000), type: 'authenticated', overwrite: false, allowed_formats: 'mp3,wav,m4a,webm,ogg,mp4,flac' };
  return { parameters, signature: cloud.utils.api_sign_request(parameters, required('CLOUDINARY_API_SECRET')), apiKey: required('CLOUDINARY_API_KEY'), uploadUrl: `https://api.cloudinary.com/v1_1/${required('CLOUDINARY_CLOUD_NAME')}/video/upload` };
}
export async function inspectAsset(publicId: string, resourceType: string, deliveryType = 'authenticated') {
  try {
    // Cloudinary omits audio duration from Admin API responses unless extended metadata is requested.
    const value: unknown = await mediaCloud().api.resource(publicId, { resource_type: resourceType, type: deliveryType, ...(resourceType==='video'?{media_metadata:true}:{}) });
    return value;
  } catch { throw new ServiceError('MEDIA_UNAVAILABLE', 503, 'The uploaded asset could not be verified.', true); }
}
export function downloadUrl(publicId: string, format: string, resourceType: string) {
  return mediaCloud().utils.private_download_url(publicId, format, { resource_type: resourceType, type: 'authenticated', expires_at: Math.floor(Date.now()/1000)+600, attachment: false });
}
export function publicMediaUrl(publicId: string, resourceType: string, format: string) {
  return mediaCloud().url(publicId, { resource_type: resourceType, type: 'upload', format, secure: true });
}
export async function storeBytes(bytes: Buffer, publicId: string, resourceType: 'image' | 'video' | 'raw', format: string, deliveryType: 'authenticated' | 'upload' = 'authenticated') {
  const cloud = mediaCloud();
  try {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloud.uploader.upload_stream({ public_id: publicId, resource_type: resourceType, type: deliveryType, overwrite: false, format, timeout: 90000 }, (error, response) => error || !response ? reject(new Error('Upload failed.')) : resolve(response));
      stream.end(bytes);
    });
    return { result, checksum: createHash('sha256').update(bytes).digest('hex') };
  } catch { throw new ServiceError('MEDIA_UPLOAD_FAILED', 503, 'Media could not be stored.', true); }
}
export async function removeAsset(publicId: string, resourceType = 'video', deliveryType = 'authenticated') {
  await mediaCloud().uploader.destroy(publicId, { resource_type: resourceType, type: deliveryType, invalidate: true });
}
export async function readMedia(url: string, maxBytes: number) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > maxBytes) throw new Error('Media unavailable.');
    const chunks: Uint8Array[] = []; let length = 0;
    const reader = response.body.getReader();
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > maxBytes) throw new Error('Media too large.'); chunks.push(value); } }
    finally { await reader.cancel(); }
    return Buffer.concat(chunks);
  } catch { throw new ServiceError('MEDIA_READ_FAILED', 503, 'Media could not be read.', true); }
}
