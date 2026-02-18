#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const dotenv = require("dotenv");

const [reactCommand, ...restArgs] = process.argv.slice(2);

if (!reactCommand) {
  console.error(
    "Usage: node scripts/run-client-react.cjs <start|build|test> [...args]"
  );
  process.exit(1);
}

const hasClientWorkspace = existsSync("client/package.json");
const rootEnvPath = resolve(process.cwd(), ".env");

if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

// Keep frontend/server ports isolated when sharing one root .env:
// - server reads PORT (typically 4000)
// - client uses CLIENT_PORT (default 3000)
process.env.PORT = process.env.CLIENT_PORT || "3000";

const run = (cmd, args) =>
  spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

let result;
if (hasClientWorkspace) {
  result = run("yarn", ["--cwd", "client", reactCommand, ...restArgs]);
} else {
  let reactScriptsPath;
  try {
    reactScriptsPath = require.resolve("react-scripts/bin/react-scripts.js", {
      paths: [process.cwd()],
    });
  } catch (error) {
    console.error("Unable to resolve react-scripts. Run `yarn install` first.");
    process.exit(1);
  }
  result = run(process.execPath, [reactScriptsPath, reactCommand, ...restArgs]);
}

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
