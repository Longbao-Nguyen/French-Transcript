export interface StoredObjectMetadata {
  pathname: string;
  size: number;
  contentType: string;
  etag: string;
}

export interface PrivateStoredObject extends StoredObjectMetadata {
  stream: ReadableStream<Uint8Array>;
}

export interface DirectUploadRequest {
  pathname: string;
  clientPayload: string | null;
  multipart: boolean;
}

export interface DirectUploadGrant {
  contentType: string;
  maximumSizeInBytes: number;
  validUntil: number;
}

export type AuthorizeDirectUpload = (request: DirectUploadRequest) => Promise<DirectUploadGrant>;

export interface ObjectStorage {
  assertConfigured(): void;
  handleDirectUploadRequest(
    body: unknown,
    authorize: AuthorizeDirectUpload,
  ): Promise<unknown>;
  headObject(pathname: string): Promise<StoredObjectMetadata | null>;
  getPrivateObject(pathname: string): Promise<PrivateStoredObject | null>;
  deleteObject(pathname: string): Promise<void>;
}
