import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const submitBrandForVerification = createBaseElysia().post(
  "/brands/:id/submit-verification",
  async ({ params, body, set, log, cookie: { session } }) => {
    try {
      if (!session.value) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Session not found",
        };
      }

      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );

      if (!dbSession || !user) {
        set.status = "Unauthorized";
        return {
          status: "error",
          message: "Invalid session",
        };
      }

      // Check if brand exists and user owns it
      const brand = await db.brand.findFirst({
        where: {
          id: params.id,
          ownerId: user.id,
        },
      });

      if (!brand) {
        set.status = "Not Found";
        return {
          status: "error",
          message: "Brand not found or you don't have permission",
        };
      }

      if (brand.status === "VERIFIED") {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Brand is already verified",
        };
      }

      if (brand.status === "PENDING") {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Brand is already pending verification",
        };
      }

      // Update brand with final information and set status to PENDING
      const updatedBrand = await db.brand.update({
        where: { id: params.id },
        data: {
          name: body.name,
          description: body.description,
          contactAddress: body.contactAddress,
          businessPhoneNumber: body.businessPhoneNumber,
          logoUrl: body.logoUrl,
          status: "PENDING",
        },
      });

      // Create certification file records if provided
      if (body.certificationFiles && body.certificationFiles.length > 0) {
        await db.brandCertification.createMany({
          data: body.certificationFiles.map((file) => ({
            brandId: params.id,
            fileUrl: file.fileUrl,
            fileName: file.fileName,
            fileType: file.fileType,
            fileSize: file.fileSize,
          })),
        });
      }

      // Create notification for user
      await db.notification.create({
        data: {
          userId: user.id,
          type: "BRAND_VERIFICATION_STATUS",
          content: `Your brand "${brand.name}" has been submitted for verification`,
        },
      });

      set.status = "OK";
      return {
        status: "success",
        message: "Brand submitted for verification",
        data: updatedBrand,
      };
    } catch (error) {
      log.error("Brand verification submission error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while submitting brand for verification",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      name: t.String({ minLength: 2, maxLength: 100 }),
      description: t.Optional(t.String({ maxLength: 1000 })),
      contactAddress: t.Optional(t.String({ maxLength: 500 })),
      businessPhoneNumber: t.Optional(t.String({ maxLength: 20 })),
      logoUrl: t.Optional(t.String()),
      certificationFiles: t.Optional(
        t.Array(
          t.Object({
            fileUrl: t.String(),
            fileName: t.String(),
            fileType: t.String(),
            fileSize: t.Number(),
          }),
        ),
      ),
    }),
    detail: {
      tags: ["Brands"],
      summary: "Submit brand for verification",
      description: "Submit brand registration for admin verification",
    },
  },
);
