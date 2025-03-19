import { logger as pinoLogger } from "@bogeychan/elysia-logger";

const logger = pinoLogger({
  level: process.env.NODE_ENV === "production" ? "error" : "debug",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
    },
  },
});

export { logger };
