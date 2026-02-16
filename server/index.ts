import { createServer, IncomingHttpHeaders } from "node:http";
import cors from "cors";
import express from "express";
import { GraphQLError } from "graphql";
import { createHandler } from "graphql-http/lib/use/express";
import { useServer } from "graphql-ws/use/ws";
import { WebSocketServer } from "ws";
import { env } from "./config/env";
import { authService } from "./services/authService";
import { getSchema } from "./schema";
import { GraphQLContext } from "./types";

const app = express();
const port = env.port;
const graphqlPath = "/graphql";
const sandboxPath = "/sandbox";
const schema = getSchema();

const resolveConnectionHeader = (connectionParams: unknown, key: string) => {
  if (!connectionParams || typeof connectionParams !== "object") {
    return undefined;
  }

  const maybeRecord = connectionParams as Record<string, unknown>;
  const direct = maybeRecord[key];
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const upper = maybeRecord[key.toUpperCase()];
  if (typeof upper === "string" && upper.trim()) {
    return upper;
  }

  return undefined;
};

const buildGraphQLContext = async (headers: IncomingHttpHeaders): Promise<GraphQLContext> => {
  const acceptLanguage = headers["accept-language"];
  let viewer: GraphQLContext["viewer"] = null;
  try {
    viewer = await authService.authenticate(headers);
  } catch (error) {
    const isUnauthenticated =
      error instanceof GraphQLError && error.extensions?.code === "UNAUTHENTICATED";
    if (!isUnauthenticated) {
      throw error;
    }
  }

  return {
    viewer,
    acceptLanguage: typeof acceptLanguage === "string" ? acceptLanguage : "en",
  };
};

app.set("trust proxy", true);
app.use((req, res, next) => {
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
});
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

if (env.graphqlSandboxEnabled) {
  app.get([sandboxPath, "/playground"], (req, res) => {
    const forwardedProto = req.header("x-forwarded-proto");
    const proto = forwardedProto ? forwardedProto.split(",")[0]?.trim() : req.protocol;
    const host = req.get("host");
    if (!host) {
      res.status(500).send("Host header missing");
      return;
    }

    const requestEndpoint = `${proto}://${host}${graphqlPath}`;
    const endpoint = env.graphqlPublicEndpoint || requestEndpoint;
    const sandboxUrl = `https://studio.apollographql.com/sandbox/explorer?endpoint=${encodeURIComponent(endpoint)}`;

    res
      .status(200)
      .type("html")
      .send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Apollo Sandbox</title>
    <style>
      html, body { height: 100%; margin: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; background: #f8fafc; }
      .toolbar { padding: 12px 16px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .btn { display: inline-block; padding: 8px 12px; border-radius: 8px; background: #111827; color: white; text-decoration: none; font-weight: 600; }
      code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; }
      #embeddableSandbox { height: calc(100% - 76px); }
      .hint { color: #475569; font-size: 13px; }
    </style>
    <script src="https://embeddable-sandbox.cdn.apollographql.com/_latest/embeddable-sandbox.umd.production.min.js"></script>
  </head>
  <body>
    <div class="toolbar">
      <a class="btn" href="${sandboxUrl}" target="_blank" rel="noopener noreferrer">Open Studio (new tab)</a>
      <span class="hint">Embedded endpoint (same-origin): <code>${requestEndpoint}</code></span>
      <span class="hint">If Studio shows "Unable to reach server" in CodeSandbox, use this embedded view.</span>
    </div>
    <div id="embeddableSandbox">
      <div style="padding:16px;color:#475569;">Loading Apollo Sandbox...</div>
    </div>
    <script>
      (function initEmbeddedSandbox() {
        var target = "#embeddableSandbox";
        var initialEndpoint = window.location.origin + ${JSON.stringify(graphqlPath)};
        var rootEl = document.getElementById("embeddableSandbox");

        try {
          if (typeof window.EmbeddedSandbox === "function") {
            new window.EmbeddedSandbox({ target: target, initialEndpoint: initialEndpoint });
            return;
          }
          if (
            window.EmbeddedSandbox &&
            typeof window.EmbeddedSandbox.renderEmbeddedSandbox === "function"
          ) {
            window.EmbeddedSandbox.renderEmbeddedSandbox({
              target: target,
              initialEndpoint: initialEndpoint,
            });
            return;
          }
        } catch (error) {
          // continue to fallback message
        }

        if (rootEl) {
          rootEl.innerHTML =
            '<div style="padding:16px;color:#b91c1c;">Failed to load embedded Apollo Sandbox. Try opening the button above in a top-level browser tab.</div>';
        }
      })();
    </script>
  </body>
</html>`);
  });
}

app.all(
  graphqlPath,
  createHandler({
    schema,
    context: async (request): Promise<GraphQLContext> => buildGraphQLContext(request.raw.headers),
  }),
);

const httpServer = createServer(app);
const wsServer = new WebSocketServer({
  server: httpServer,
  path: graphqlPath,
});

useServer(
  {
    schema,
    context: async (ctx): Promise<GraphQLContext> => {
      const headers: IncomingHttpHeaders = {
        ...ctx.extra.request.headers,
      };

      const connectionAuthorization = resolveConnectionHeader(ctx.connectionParams, "authorization");
      if (connectionAuthorization) {
        headers.authorization = connectionAuthorization;
      }

      const connectionDevUserId = resolveConnectionHeader(ctx.connectionParams, "x-user-id");
      if (connectionDevUserId) {
        headers["x-user-id"] = connectionDevUserId;
      }

      return buildGraphQLContext(headers);
    },
  },
  wsServer,
);

httpServer.listen(port, () => {
  console.log(`GraphQL server ready at http://localhost:${port}${graphqlPath}`);
  console.log(`GraphQL subscriptions ready at ws://localhost:${port}${graphqlPath}`);
  if (env.graphqlSandboxEnabled) {
    console.log(`Apollo Sandbox redirect: http://localhost:${port}${sandboxPath}`);
  }
});
