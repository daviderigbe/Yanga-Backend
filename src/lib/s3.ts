import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = Bun.env.S3_BUCKET_NAME!;

// Allowed file types and sizes
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES_PER_UPLOAD = 10;

export interface UploadResult {
  url: string;
  key: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface UploadError {
  filename: string;
  error: string;
}

export interface BatchUploadResult {
  successful: UploadResult[];
  failed: UploadError[];
}

/**
 * Generate a unique file key for S3
 */
function generateFileKey(
  originalFilename: string,
  folder: string = "products",
): string {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const extension = originalFilename.split(".").pop()?.toLowerCase() || "";
  return `${folder}/${timestamp}-${randomString}.${extension}`;
}

/**
 * Validate file before upload
 */
function validateFile(file: File): { isValid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  return { isValid: true };
}

/**
 * Upload a single file to S3
 */
export async function uploadSingleFile(
  file: File,
  folder: string = "products",
): Promise<UploadResult> {
  // Validate file
  const validation = validateFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // Generate unique key
  const key = generateFileKey(file.name, folder);

  // Convert file to buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload to S3
  const uploadCommand = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: file.type,
    ContentLength: file.size,
    // Optional: Add metadata
    Metadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(uploadCommand);

  // Return result
  const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  return {
    url,
    key,
    filename: file.name,
    size: file.size,
    mimeType: file.type,
  };
}

/**
 * Upload multiple files to S3
 */
export async function uploadMultipleFiles(
  files: File[],
  folder: string = "products",
): Promise<BatchUploadResult> {
  if (files.length > MAX_FILES_PER_UPLOAD) {
    throw new Error(`Too many files. Maximum allowed: ${MAX_FILES_PER_UPLOAD}`);
  }

  const successful: UploadResult[] = [];
  const failed: UploadError[] = [];

  // Process uploads concurrently
  const uploadPromises = files.map(async (file) => {
    try {
      const result = await uploadSingleFile(file, folder);
      successful.push(result);
    } catch (error) {
      failed.push({
        filename: file.name,
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  });

  await Promise.all(uploadPromises);

  return { successful, failed };
}

/**
 * Delete a file from S3
 */
export async function deleteFile(key: string): Promise<void> {
  const deleteCommand = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(deleteCommand);
}

/**
 * Delete multiple files from S3
 */
export async function deleteMultipleFiles(keys: string[]): Promise<void> {
  const deletePromises = keys.map((key) => deleteFile(key));
  await Promise.all(deletePromises);
}

/**
 * Generate presigned URL for direct upload (optional)
 */
export async function generatePresignedUploadUrl(
  filename: string,
  folder: string = "products",
  expiresIn: number = 3600, // 1 hour
): Promise<{ url: string; key: string }> {
  const key = generateFileKey(filename, folder);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });

  return { url, key };
}

/**
 * Extract S3 key from URL
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading slash
  } catch {
    return null;
  }
}
