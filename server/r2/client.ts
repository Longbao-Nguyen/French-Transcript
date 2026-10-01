import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface R2Config {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

let client: S3Client | undefined;

function getConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  const config = {
    bucket: process.env.R2_BUCKET_NAME || '',
    endpoint,
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  };

  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing R2 configuration: ${missing.join(', ')}`);
  }
  return config;
}

function getClient(): { client: S3Client; config: R2Config } {
  const config = getConfig();
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return { client, config };
}

export async function createUploadUrl(input: {
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const { client: r2, config } = getClient();
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    }),
    { expiresIn: 15 * 60 },
  );
}

export async function headObject(key: string): Promise<HeadObjectCommandOutput | null> {
  const { client: r2, config } = getClient();
  try {
    return await r2.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (name === 'NotFound' || name === 'NoSuchKey' || status === 404) return null;
    throw error;
  }
}

export async function createDownloadUrl(key: string): Promise<string> {
  const { client: r2, config } = getClient();
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: 5 * 60 },
  );
}
