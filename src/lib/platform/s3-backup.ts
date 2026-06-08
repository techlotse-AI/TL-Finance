import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { ApiError } from "@/lib/api/errors";

interface S3BackupConfiguration {
  endpoint?: string;
  region: string;
  bucket: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  serverSideEncryption?: "AES256" | "aws:kms";
  kmsKeyId?: string;
}

export function s3BackupStatus() {
  return {
    configured: Boolean(
      process.env.S3_BACKUP_REGION &&
      process.env.S3_BACKUP_BUCKET &&
      process.env.S3_BACKUP_ACCESS_KEY_ID &&
      process.env.S3_BACKUP_SECRET_ACCESS_KEY,
    ),
    endpoint: process.env.S3_BACKUP_ENDPOINT || "AWS default",
    region: process.env.S3_BACKUP_REGION || "Not configured",
    bucket: process.env.S3_BACKUP_BUCKET || "Not configured",
    prefix: process.env.S3_BACKUP_PREFIX || "tl-finance",
    forcePathStyle: process.env.S3_BACKUP_FORCE_PATH_STYLE === "true",
    serverSideEncryption: process.env.S3_BACKUP_SERVER_SIDE_ENCRYPTION || "AES256",
    kmsKeyIdConfigured: Boolean(process.env.S3_BACKUP_KMS_KEY_ID),
  };
}

export async function uploadPlatformBackup(snapshot: unknown) {
  const config = requireS3BackupConfiguration();
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const key = `${config.prefix.replace(/^\/+|\/+$/g, "")}/platform-${timestamp}.json`;
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const body = JSON.stringify(snapshot);
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: "application/json",
    ...(config.serverSideEncryption ? {
      ServerSideEncryption: config.serverSideEncryption,
      ...(config.kmsKeyId ? { SSEKMSKeyId: config.kmsKeyId } : {}),
    } : {}),
  }));
  return { bucket: config.bucket, key, bytes: Buffer.byteLength(body) };
}

function requireS3BackupConfiguration(): S3BackupConfiguration {
  const status = s3BackupStatus();
  if (!status.configured) {
    throw new ApiError(503, "s3_backup_not_configured", "S3-compatible platform backup storage is not configured.");
  }
  const encryption = process.env.S3_BACKUP_SERVER_SIDE_ENCRYPTION || "AES256";
  if (encryption !== "AES256" && encryption !== "aws:kms" && encryption !== "none") {
    throw new ApiError(503, "s3_backup_invalid_configuration", "S3 backup server-side encryption must be AES256, aws:kms, or none.");
  }
  if (encryption === "aws:kms" && !process.env.S3_BACKUP_KMS_KEY_ID) {
    throw new ApiError(503, "s3_backup_invalid_configuration", "S3 KMS encryption requires S3_BACKUP_KMS_KEY_ID.");
  }
  return {
    endpoint: process.env.S3_BACKUP_ENDPOINT || undefined,
    region: process.env.S3_BACKUP_REGION!,
    bucket: process.env.S3_BACKUP_BUCKET!,
    prefix: process.env.S3_BACKUP_PREFIX || "tl-finance",
    accessKeyId: process.env.S3_BACKUP_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_BACKUP_SECRET_ACCESS_KEY!,
    forcePathStyle: process.env.S3_BACKUP_FORCE_PATH_STYLE === "true",
    serverSideEncryption: encryption === "none" ? undefined : encryption,
    kmsKeyId: process.env.S3_BACKUP_KMS_KEY_ID || undefined,
  };
}
