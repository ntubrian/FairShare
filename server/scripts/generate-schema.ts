import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { printSchema } from "graphql";
import { getSchema } from "../schema";

const outputPath = resolve(process.cwd(), "graphql/schema.graphql");
const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
const next = `${printSchema(getSchema())}\n`;

mkdirSync(dirname(outputPath), { recursive: true });
if (current !== next) {
  writeFileSync(outputPath, next, "utf8");
}

console.log(`Generated schema from TypeGraphQL at ${outputPath}`);
