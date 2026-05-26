import OSS from 'ali-oss';

function getClient() {
  return new OSS({
    region: process.env.OSS_REGION!,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    bucket: process.env.OSS_BUCKET!,
  });
}

export function generateUploadUrl(fileKey: string, contentType: string): string {
  const client = getClient();
  return client.signatureUrl(fileKey, {
    method: 'PUT',
    expires: 900,
    'Content-Type': contentType,
  } as any);
}

export function generateDownloadUrl(fileKey: string): string {
  const client = getClient();
  return client.signatureUrl(fileKey, { expires: 3600 });
}

export async function deleteObject(fileKey: string): Promise<void> {
  const client = getClient();
  await client.delete(fileKey);
}
