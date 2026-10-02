import {
  BlobNotFoundError,
  del,
  get,
  head,
  issueSignedToken,
  presignUrl,
  type PresignedUrlPayload,
} from '@vercel/blob';

import type {
  AuthorizeDirectUpload,
  ObjectStorage,
  PrivateStoredObject,
  StoredObjectMetadata,
} from '../interface.js';

function getStoreId(): string {
  const storeId = process.env.BLOB_STORE_ID;
  if (!storeId) {
    throw new Error('BLOB_STORE_ID is required for the Vercel Blob storage provider.');
  }
  return storeId;
}

interface GeneratePresignedUrlBody {
  type: 'blob.generate-presigned-url';
  payload: {
    pathname: string;
    clientPayload: string | null;
    multipart: boolean;
  };
}

function parseGeneratePresignedUrlBody(body: unknown): GeneratePresignedUrlBody {
  if (!body || typeof body !== 'object') throw new Error('Invalid direct upload request.');
  const candidate = body as Partial<GeneratePresignedUrlBody>;
  const payload = candidate.payload;
  if (
    candidate.type !== 'blob.generate-presigned-url'
    || !payload
    || typeof payload.pathname !== 'string'
    || (payload.clientPayload !== null && typeof payload.clientPayload !== 'string')
    || typeof payload.multipart !== 'boolean'
  ) {
    throw new Error('Invalid direct upload request.');
  }
  return candidate as GeneratePresignedUrlBody;
}

export function extractPresignedUrlPayload(presignedUrl: string): PresignedUrlPayload {
  const url = new URL(presignedUrl);
  const delegationToken = url.searchParams.get('vercel-blob-delegation');
  const signature = url.searchParams.get('vercel-blob-signature');
  if (!delegationToken || !signature) throw new Error('Vercel Blob returned an invalid presigned URL.');

  url.searchParams.delete('pathname');
  url.searchParams.delete('vercel-blob-delegation');
  url.searchParams.delete('vercel-blob-signature');
  return {
    delegationToken,
    signature,
    params: Object.fromEntries(url.searchParams.entries()),
  };
}

export class VercelBlobStorage implements ObjectStorage {
  assertConfigured(): void {
    getStoreId();
  }

  async handleDirectUploadRequest(
    body: unknown,
    authorize: AuthorizeDirectUpload,
  ): Promise<unknown> {
    const event = parseGeneratePresignedUrlBody(body);
    const { pathname, clientPayload, multipart } = event.payload;
    const grant = await authorize({ pathname, clientPayload, multipart });
    const allowedContentTypes = [grant.contentType];
    const signedToken = await issueSignedToken({
      storeId: getStoreId(),
      pathname,
      operations: ['put'],
      allowedContentTypes,
      maximumSizeInBytes: grant.maximumSizeInBytes,
      validUntil: grant.validUntil,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      access: 'private',
      operation: 'put',
      pathname,
      allowedContentTypes,
      maximumSizeInBytes: grant.maximumSizeInBytes,
      validUntil: grant.validUntil,
      addRandomSuffix: false,
      allowOverwrite: false,
    });

    return {
      type: event.type,
      presignedUrlPayload: extractPresignedUrlPayload(presignedUrl),
    };
  }

  async headObject(pathname: string): Promise<StoredObjectMetadata | null> {
    try {
      const object = await head(pathname, { storeId: getStoreId() });
      return {
        pathname: object.pathname,
        size: object.size,
        contentType: object.contentType,
        etag: object.etag,
      };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  }

  async getPrivateObject(pathname: string): Promise<PrivateStoredObject | null> {
    const object = await get(pathname, {
      access: 'private',
      storeId: getStoreId(),
    });
    if (!object || object.statusCode !== 200) return null;

    return {
      pathname: object.blob.pathname,
      size: object.blob.size,
      contentType: object.blob.contentType,
      etag: object.blob.etag,
      stream: object.stream,
    };
  }

  async deleteObject(pathname: string): Promise<void> {
    await del(pathname, { storeId: getStoreId() });
  }
}
