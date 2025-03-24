import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

export const fetchCategories = createBaseElysia().get(
  "",
  async ({ log, set }) => {
    try {
      const categories = await db.category.findMany({});

      set.status = "OK";
      return {
        status: "success",
        message: "Categories fetched successfully",
        data: categories,
      };
    } catch (error) {
      log.error(error);
      set.status = 500;
      return {
        status: "error",
        message: "Failed to fetch categories",
      };
    }
  },
  {
    response: t.Object({
      status: t.Enum({ success: "success", error: "error" }),
      message: t.String(),
      data: t.Optional(
        t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
          }),
        ),
      ),
    }),
    detail: {
      tags: ["Categories"],
      summary: "Fetch all categories",
      description:
        "Fetch all categories for use in forms for select and other stuff",
    },
  },
);
