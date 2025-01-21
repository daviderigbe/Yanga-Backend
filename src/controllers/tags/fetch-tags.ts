import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

export const fetchTags = createBaseElysia().get(
  "",
  async ({ log, set }) => {
    try {
      const tags = db.tag.findMany({});

      set.status = "OK";
      return {
        status: "success",
        message: "Tags fetched successfully",
        data: tags,
      };
    } catch (error) {
      log.error(error);
      set.status = 500;
      return {
        status: "error",
        message: "Failed to fetch tags",
      };
    }
  },
  {
    response: t.Object({
      status: t.Enum({ success: "success", error: "error" }),
      message: t.String(),
      data: t.Optional(
        t.Object({
          id: t.String(),
          name: t.String(),
        }),
      ),
    }),
    detail: {
      tags: ["Tags"],
      summary: "Fetch all tags",
      description: "Fetch all tags for use in forms for select and other stuff",
    },
  },
);
