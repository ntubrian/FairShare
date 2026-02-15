import { config as loadDotEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadDotEnv();

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://placeholder:placeholder@localhost:5432/placeholder",
  },
  strict: true,
  verbose: true,
});
