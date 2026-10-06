import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const endpoint = process.env.R2_ENDPOINT || 'http://127.0.0.1:9090';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || 'mock-key';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || 'mock-secret';
const bucketName = process.env.R2_BUCKET_NAME || 'vokalog';
const publicDomain = process.env.R2_PUBLIC_DOMAIN || `${endpoint}/${bucketName}`;

export const s3Client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true, // Necessary for local S3 mock path resolution
});

export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 300
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: expiresInSeconds,
  });

  const publicUrl = `${publicDomain}/${key}`;

  return { uploadUrl, publicUrl, key };
}
