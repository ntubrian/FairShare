import { config as loadDotenv } from "dotenv";

loadDotenv();

const read = (name: string, fallback = "") => process.env[name] ?? fallback;
const nodeEnv = read("NODE_ENV", "development");
const defaultIdeEnabled = nodeEnv === "production" ? "false" : "true";
const legacyPlaygroundEnabled = read("GRAPHQL_PLAYGROUND_ENABLED", "");
const legacySandboxEnabled = read("GRAPHQL_SANDBOX_ENABLED", "");

export const env = {
  port: Number(read("PORT", "4000")),
  nodeEnv,
  databaseUrl: read("DATABASE_URL"),
  graphqlPublicEndpoint: read("GRAPHQL_PUBLIC_ENDPOINT"),
  googleClientId: read("GOOGLE_CLIENT_ID"),
  allowDevAuthBypass: read("ALLOW_DEV_AUTH_BYPASS", "false") === "true",
  graphqlSandboxEnabled:
    read(
      "GRAPHQL_IDE_ENABLED",
      legacySandboxEnabled || legacyPlaygroundEnabled || defaultIdeEnabled
    ) === "true",
};
