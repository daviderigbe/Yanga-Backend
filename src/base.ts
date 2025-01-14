import { Elysia, type ElysiaConfig } from "elysia";
import { logger } from "./plugins/logger";

//WARN:
// pls do not touch this code, i genuinely don't understand it.
// i just copied it from somewhere else and it actually works
// thank you

const baseElysia = <const BasePath extends string = "">(
  config?: ElysiaConfig<BasePath>,
) => new Elysia(config).use(logger);

const createBaseElysia = (config?: Parameters<typeof baseElysia>[0]) =>
  new Elysia(config) as ReturnType<typeof baseElysia>;

export { createBaseElysia, baseElysia };
