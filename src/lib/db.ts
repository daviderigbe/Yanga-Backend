import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const db = globalThis.prisma || new PrismaClient();

if (Bun.env.NODE_ENV !== "production") {
  globalThis.prisma = db;
}
