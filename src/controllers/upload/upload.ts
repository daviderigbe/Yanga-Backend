import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import {
  uploadSingleFile,
  uploadMultipleFiles,
  generatePresignedUploadUrl,
  deleteFile,
  extractKeyFromUrl,
  type BatchUploadResult,
  type UploadResult,
} from "../../lib/s3";
import { t } from "elysia";

export const uploadRoutes = createBaseElysia().group("/upload", (app) =>
  app
    // Single file upload
    .post(
      "/single",
      async ({ log, set, body, cookie: { session } }) => {
        try {
          // Authentication check
          if (!session.value) {
            set.status = 401;
            return {
              status: "error",
              message: "Authentication required",
            };
          }

          const { session: dbSession, user } = await validateSessionToken(
            session.value,
          );

          if (!dbSession || !user) {
            set.status = 401;
            return {
              status: "error",
              message: "Invalid session",
            };
          }

          if (user.isDeactivated) {
            set.status = 403;
            return {
              status: "error",
              message: "Account is deactivated",
            };
          }

          const { file, folder = "products" } = body;

          if (!file) {
            set.status = 400;
            return {
              status: "error",
              message: "No file provided",
            };
          }

          // Upload file
          const result: UploadResult = await uploadSingleFile(file, folder);

          return {
            status: "success",
            message: "File uploaded successfully",
            data: result,
          };
        } catch (error) {
          log.error("Single file upload error:", error);

          set.status = 400;
          return {
            status: "error",
            message: error instanceof Error ? error.message : "Upload failed",
          };
        }
      },
      {
        body: t.Object({
          file: t.File(),
          folder: t.Optional(t.String()),
        }),
        detail: {
          tags: ["Upload"],
          summary: "Upload a single file",
          description: "Upload a single image file to S3",
          responses: {
            200: {
              description: "File uploaded successfully",
            },
            400: {
              description: "Bad request - invalid file or upload error",
            },
            401: {
              description: "Unauthorized - missing or invalid session",
            },
          },
        },
      },
    )

    // Multiple files upload
    .post(
      "/multiple",
      async ({ log, set, body, cookie: { session } }) => {
        try {
          // Authentication check
          if (!session.value) {
            set.status = 401;
            return {
              status: "error",
              message: "Authentication required",
            };
          }

          const { session: dbSession, user } = await validateSessionToken(
            session.value,
          );

          if (!dbSession || !user) {
            set.status = 401;
            return {
              status: "error",
              message: "Invalid session",
            };
          }

          if (user.isDeactivated) {
            set.status = 403;
            return {
              status: "error",
              message: "Account is deactivated",
            };
          }

          const { files, folder = "products" } = body;

          if (!files || files.length === 0) {
            set.status = 400;
            return {
              status: "error",
              message: "No files provided",
            };
          }

          // Upload files
          const result: BatchUploadResult = await uploadMultipleFiles(
            files,
            folder,
          );

          // Determine response status based on results
          const hasFailures = result.failed.length > 0;
          const hasSuccesses = result.successful.length > 0;

          if (hasFailures && !hasSuccesses) {
            set.status = 400;
            return {
              status: "error",
              message: "All uploads failed",
              data: result,
            };
          }

          return {
            status: hasFailures ? "partial" : "success",
            message: hasFailures
              ? `${result.successful.length} files uploaded, ${result.failed.length} failed`
              : "All files uploaded successfully",
            data: result,
          };
        } catch (error) {
          log.error("Multiple files upload error:", error);

          set.status = 400;
          return {
            status: "error",
            message: error instanceof Error ? error.message : "Upload failed",
          };
        }
      },
      {
        body: t.Object({
          files: t.Array(t.File()),
          folder: t.Optional(t.String()),
        }),
        detail: {
          tags: ["Upload"],
          summary: "Upload multiple files",
          description: "Upload multiple image files to S3",
          responses: {
            200: {
              description: "Files uploaded (check data for individual results)",
            },
            400: {
              description: "Bad request - invalid files or upload error",
            },
            401: {
              description: "Unauthorized - missing or invalid session",
            },
          },
        },
      },
    )

    // Generate presigned URL for direct upload
    .post(
      "/presigned-url",
      async ({ log, set, body, cookie: { session } }) => {
        try {
          // Authentication check
          if (!session.value) {
            set.status = 401;
            return {
              status: "error",
              message: "Authentication required",
            };
          }

          const { session: dbSession, user } = await validateSessionToken(
            session.value,
          );

          if (!dbSession || !user) {
            set.status = 401;
            return {
              status: "error",
              message: "Invalid session",
            };
          }

          if (user.isDeactivated) {
            set.status = 403;
            return {
              status: "error",
              message: "Account is deactivated",
            };
          }

          const { filename, folder = "products", expiresIn = 3600 } = body;

          // Generate presigned URL
          const result = await generatePresignedUploadUrl(
            filename,
            folder,
            expiresIn,
          );

          return {
            status: "success",
            message: "Presigned URL generated successfully",
            data: {
              uploadUrl: result.url,
              key: result.key,
              expiresIn,
            },
          };
        } catch (error) {
          log.error("Presigned URL generation error:", error);

          set.status = 500;
          return {
            status: "error",
            message: "Failed to generate presigned URL",
          };
        }
      },
      {
        body: t.Object({
          filename: t.String(),
          folder: t.Optional(t.String()),
          expiresIn: t.Optional(t.Number({ minimum: 60, maximum: 86400 })), // 1 min to 24 hours
        }),
        detail: {
          tags: ["Upload"],
          summary: "Generate presigned upload URL",
          description:
            "Generate a presigned URL for direct client-side upload to S3",
          responses: {
            200: {
              description: "Presigned URL generated successfully",
            },
            401: {
              description: "Unauthorized - missing or invalid session",
            },
            500: {
              description: "Server error",
            },
          },
        },
      },
    )

    // Delete file
    .delete(
      "/delete",
      async ({ log, set, body, cookie: { session } }) => {
        try {
          // Authentication check
          if (!session.value) {
            set.status = 401;
            return {
              status: "error",
              message: "Authentication required",
            };
          }

          const { session: dbSession, user } = await validateSessionToken(
            session.value,
          );

          if (!dbSession || !user) {
            set.status = 401;
            return {
              status: "error",
              message: "Invalid session",
            };
          }

          if (user.isDeactivated) {
            set.status = 403;
            return {
              status: "error",
              message: "Account is deactivated",
            };
          }

          const { url, key } = body;

          // Extract key from URL if provided, otherwise use the key directly
          let fileKey = key;
          if (url && !key) {
            fileKey = extractKeyFromUrl(url);
            if (!fileKey) {
              set.status = 400;
              return {
                status: "error",
                message: "Invalid URL provided",
              };
            }
          }

          if (!fileKey) {
            set.status = 400;
            return {
              status: "error",
              message: "Either URL or key must be provided",
            };
          }

          // Delete file
          await deleteFile(fileKey);

          return {
            status: "success",
            message: "File deleted successfully",
          };
        } catch (error) {
          log.error("File deletion error:", error);

          set.status = 500;
          return {
            status: "error",
            message: "Failed to delete file",
          };
        }
      },
      {
        body: t.Object({
          url: t.Optional(t.String()),
          key: t.Optional(t.String()),
        }),
        detail: {
          tags: ["Upload"],
          summary: "Delete a file",
          description: "Delete a file from S3 using URL or key",
          responses: {
            200: {
              description: "File deleted successfully",
            },
            400: {
              description: "Bad request - invalid URL or key",
            },
            401: {
              description: "Unauthorized - missing or invalid session",
            },
            500: {
              description: "Server error",
            },
          },
        },
      },
    ),
);
