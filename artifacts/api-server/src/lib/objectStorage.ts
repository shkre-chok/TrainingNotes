import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { File, Storage } from '@google-cloud/storage';

import {
  canAccessObject,
  getObjectAclPolicy,
  ObjectAclPolicy,
  ObjectPermission,
  setObjectAclPolicy,
} from './objectAcl';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

let gcsClient: Storage | undefined;

// Lazily constructed so a local-only dev run never touches this.
function getGcsClient(): Storage {
  if (!gcsClient) {
    gcsClient = new Storage({
      credentials: {
        audience: 'replit',
        subject_token_type: 'access_token',
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: 'external_account',
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: 'json',
            subject_token_field_name: 'access_token',
          },
        },
        universe_domain: 'googleapis.com',
      },
      projectId: '',
    });
  }
  return gcsClient;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// A handle to a stored object. Both service implementations below produce
// and consume this same shape so callers don't need to care which driver is
// active.
export type ObjectHandle =
  | { driver: 'gcs'; file: File }
  | { driver: 'local'; absolutePath: string };

/**
 * GCS-backed implementation. On Replit this authenticates through the
 * sidecar; outside Replit it expects standard Google Cloud credentials
 * (e.g. GOOGLE_APPLICATION_CREDENTIALS) to be available instead.
 */
export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';
    const paths = Array.from(
      new Set(
        pathsStr
          .split(',')
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          'tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths).',
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || '';
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          'tool and set PRIVATE_OBJECT_DIR env var.',
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<ObjectHandle | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = getGcsClient().bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return { driver: 'gcs', file };
      }
    }

    return null;
  }

  async downloadObject(
    handle: ObjectHandle,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    if (handle.driver !== 'gcs') {
      throw new Error('Expected a GCS object handle');
    }
    const file = handle.file;
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === 'public';

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      'Content-Type':
        (metadata.contentType as string) || 'application/octet-stream',
      'Cache-Control': `${isPublic ? 'public' : 'private'}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers['Content-Length'] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(_baseUrl?: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          'tool and set PRIVATE_OBJECT_DIR env var.',
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: 'PUT',
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<ObjectHandle> {
    if (!objectPath.startsWith('/objects/')) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split('/');
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join('/');
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith('/')) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = getGcsClient().bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return { driver: 'gcs', file: objectFile };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith('https://storage.googleapis.com/')) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith('/')) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith('/')) {
      return normalizedPath;
    }

    const handle = await this.getObjectEntityFile(normalizedPath);
    if (handle.driver !== 'gcs') {
      throw new Error('Expected a GCS object handle');
    }
    await setObjectAclPolicy(handle.file, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectHandle,
    requestedPermission,
  }: {
    userId?: string;
    objectHandle: ObjectHandle;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    if (objectHandle.driver !== 'gcs') {
      throw new Error('Expected a GCS object handle');
    }
    return canAccessObject({
      userId,
      objectFile: objectHandle.file,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

/**
 * Local-disk implementation used for development outside Replit
 * (OBJECT_STORAGE_DRIVER=local, the default in .env.example). Uploads are
 * written to OBJECT_STORAGE_LOCAL_DIR instead of a real cloud bucket, and
 * "signed URLs" just point at this server's own /storage/local-uploads
 * route. There's no ACL enforcement here — it's dev-only.
 */
export class LocalObjectStorageService {
  private readonly rootDir: string;

  constructor() {
    this.rootDir = path.resolve(
      process.cwd(),
      process.env.OBJECT_STORAGE_LOCAL_DIR || '.data/objects',
    );
  }

  private privateDir(): string {
    return process.env.PRIVATE_OBJECT_DIR?.trim() || '/local-private';
  }

  private publicSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';
    const configured = pathsStr
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return configured.length > 0 ? configured : ['/local-public'];
  }

  private resolveEntityPath(relativePath: string): string {
    const normalized = path.normalize(`/${relativePath}`);
    const absolute = path.join(this.rootDir, normalized);
    if (!absolute.startsWith(this.rootDir)) {
      throw new ObjectNotFoundError();
    }
    return absolute;
  }

  async searchPublicObject(filePath: string): Promise<ObjectHandle | null> {
    for (const searchPath of this.publicSearchPaths()) {
      const absolutePath = this.resolveEntityPath(`${searchPath}/${filePath}`);
      try {
        await fs.stat(absolutePath);
        return { driver: 'local', absolutePath };
      } catch {
        // not found under this search path, try the next one
      }
    }
    return null;
  }

  async downloadObject(handle: ObjectHandle): Promise<Response> {
    if (handle.driver !== 'local') {
      throw new Error('Expected a local object handle');
    }
    let contentType = 'application/octet-stream';
    try {
      const meta = await fs.readFile(`${handle.absolutePath}.meta.json`, 'utf8');
      contentType = (JSON.parse(meta) as { contentType?: string }).contentType || contentType;
    } catch {
      // no metadata written for this object, fall back to the default
    }

    const buffer = await fs.readFile(handle.absolutePath);
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=0',
        'Content-Length': String(buffer.byteLength),
      },
    });
  }

  /**
   * Returns a path (not a real signed URL) under this server's own
   * /storage/local-uploads route. `baseUrl` is filled in by the route
   * handler from the incoming request so it resolves to the right host.
   */
  async getObjectEntityUploadURL(baseUrl?: string): Promise<string> {
    const resolvedBaseUrl = baseUrl || process.env.APP_URL || 'http://localhost:8080';
    const objectId = randomUUID();
    return `${resolvedBaseUrl.replace(/\/$/, '')}/api/storage/local-uploads/${objectId}`;
  }

  async writeLocalUpload(
    objectId: string,
    data: Buffer,
    contentType: string,
  ): Promise<void> {
    const entityDir = this.privateDir().replace(/\/+$/, '');
    const absolutePath = this.resolveEntityPath(`${entityDir}/uploads/${objectId}`);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, data);
    await fs.writeFile(
      `${absolutePath}.meta.json`,
      JSON.stringify({ contentType }),
    );
  }

  async getObjectEntityFile(objectPath: string): Promise<ObjectHandle> {
    if (!objectPath.startsWith('/objects/')) {
      throw new ObjectNotFoundError();
    }
    const entityId = objectPath.slice('/objects/'.length);
    const entityDir = this.privateDir().replace(/\/+$/, '');
    const absolutePath = this.resolveEntityPath(`${entityDir}/uploads/${entityId}`);
    try {
      await fs.stat(absolutePath);
    } catch {
      throw new ObjectNotFoundError();
    }
    return { driver: 'local', absolutePath };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    const marker = '/api/storage/local-uploads/';
    const markerIndex = rawPath.indexOf(marker);
    if (markerIndex === -1) {
      return rawPath;
    }
    const objectId = rawPath.slice(markerIndex + marker.length);
    return `/objects/${objectId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    _aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    // No ACL enforcement in local dev mode.
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(_args: {
    userId?: string;
    objectHandle: ObjectHandle;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    // No ACL enforcement in local dev mode.
    return true;
  }
}

export type AnyObjectStorageService = ObjectStorageService | LocalObjectStorageService;

export function isLocalObjectStorageDriver(): boolean {
  return (process.env.OBJECT_STORAGE_DRIVER || 'local') === 'local';
}

export function createObjectStorageService(): AnyObjectStorageService {
  return isLocalObjectStorageDriver()
    ? new LocalObjectStorageService()
    : new ObjectStorageService();
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const pathParts = path.split('/');
  if (pathParts.length < 3) {
    throw new Error('Invalid path: must contain at least a bucket name');
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join('/');

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`,
    );
  }

  const { signed_url: signedURL } = await response.json() as { signed_url?: string };
  if (!signedURL) {
    throw new Error("Object storage signing response did not include a URL");
  }
  return signedURL;
}
