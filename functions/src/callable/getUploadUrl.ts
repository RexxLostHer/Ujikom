import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { v4 as uuidv4 } from 'uuid';
import { generatePresignedUploadUrl } from '../utils/r2';

export interface GetUploadUrlRequest {
  filename?: string;
  contentType: string;
  folder?: 'logbooks' | 'finalReports' | 'avatars' | 'proofs';
  path?: string;
  bucket?: string;
}

export interface GetUploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresAt: number;
}

export const ALLOWED_FOLDERS = ['logbooks', 'finalReports', 'avatars', 'proofs'] as const;

export const FOLDER_MIME_WHITELIST: Record<string, string[]> = {
  logbooks: ['image/jpeg', 'image/png', 'image/webp'],
  avatars: ['image/jpeg', 'image/png', 'image/webp'],
  proofs: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  finalReports: ['application/pdf'],
};

export async function handleGetUploadUrl(
  data: GetUploadUrlRequest,
  authContext: any,
  urlSignerFn = generatePresignedUploadUrl
): Promise<GetUploadUrlResponse> {
  if (!authContext) {
    throw new HttpsError('unauthenticated', 'Pengguna harus login untuk mengunggah file.');
  }

  const reqData = data || ({} as GetUploadUrlRequest);
  let folder = reqData.folder;
  let filename = reqData.filename;

  // Support path parameter e.g. "logbooks/my-photo.jpg"
  if (!folder && reqData.path) {
    const parts = reqData.path.split('/');
    if (parts.length > 1) {
      folder = parts[0] as any;
      filename = parts.slice(1).join('_');
    } else {
      filename = reqData.path;
      folder = 'logbooks';
    }
  }

  if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
    throw new HttpsError('invalid-argument', `Folder '${folder}' tidak diizinkan.`);
  }

  const contentType = reqData.contentType;
  const allowedTypes = FOLDER_MIME_WHITELIST[folder];
  if (!contentType || !allowedTypes.includes(contentType)) {
    throw new HttpsError(
      'invalid-argument',
      `Tipe konten '${contentType}' tidak diizinkan untuk folder '${folder}'. Diizinkan: ${allowedTypes.join(', ')}`
    );
  }

  filename = filename || `file_${Date.now()}`;
  const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uid = authContext.uid;
  const key = `${folder}/${uid}/${Date.now()}_${uuidv4().substring(0, 8)}_${cleanFilename}`;

  const { uploadUrl, publicUrl } = await urlSignerFn(key, contentType, 300);

  return {
    uploadUrl,
    publicUrl,
    key,
    expiresAt: Date.now() + 300 * 1000,
  };
}

export const getUploadUrl = onCall<GetUploadUrlRequest>((request) =>
  handleGetUploadUrl(request.data, request.auth)
);
