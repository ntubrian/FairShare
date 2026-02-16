import { ApolloClient, InMemoryCache } from "@apollo/client/core";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";
import { SetContextLink } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { HttpLink } from "@apollo/client/link/http";

const GOOGLE_TOKEN_KEY = "fairshare.googleIdToken";
const DEV_USER_ID_KEY = "fairshare.devUserId";
const looksLikeJwt = (value: string) => value.split(".").length === 3;
const TOKEN_EXP_SKEW_SECONDS = 30;

const resolveGraphQLEndpoint = () => {
  const configuredEndpoint = process.env.REACT_APP_GRAPHQL_ENDPOINT;

  if (
    typeof window !== "undefined" &&
    window.location.hostname.includes("-3000.csb.app")
  ) {
    const sandboxEndpoint = `${
      window.location.protocol
    }//${window.location.hostname.replace(
      "-3000.csb.app",
      "-4000.csb.app"
    )}/graphql`;
    if (!configuredEndpoint) {
      return sandboxEndpoint;
    }
    if (configuredEndpoint.includes("localhost:4000")) {
      return sandboxEndpoint;
    }
    return configuredEndpoint;
  }

  if (configuredEndpoint) {
    return configuredEndpoint;
  }

  return "http://localhost:4000/graphql";
};

const readStorage = (key: string) => {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(key) ?? "";
};

const writeStorage = (key: string, value: string) => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(key, value);
};

const removeStorage = (key: string) => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(key);
};

const readConfiguredGoogleIdToken = () => {
  const configured = process.env.REACT_APP_GOOGLE_ID_TOKEN?.trim() ?? "";
  return looksLikeJwt(configured) ? configured : "";
};

const readConfiguredDevUserId = () =>
  process.env.REACT_APP_DEV_USER_ID?.trim() ?? "";

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const segments = token.split(".");
  const payload = segments[1];
  if (!payload) {
    return null;
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  try {
    const decoded =
      typeof window !== "undefined" && typeof window.atob === "function"
        ? window.atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const isJwtExpired = (token: string) => {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + TOKEN_EXP_SKEW_SECONDS;
};

const readRuntimeGoogleIdToken = () => {
  const token = readStorage(GOOGLE_TOKEN_KEY).trim();
  if (!looksLikeJwt(token)) {
    return "";
  }
  if (isJwtExpired(token)) {
    removeStorage(GOOGLE_TOKEN_KEY);
    return "";
  }
  return token;
};

const readRuntimeDevUserId = () => readStorage(DEV_USER_ID_KEY).trim();

export const authStorage = {
  getGoogleIdToken: () => readRuntimeGoogleIdToken(),
  setGoogleIdToken: (token: string) => writeStorage(GOOGLE_TOKEN_KEY, token),
  clearGoogleIdToken: () => removeStorage(GOOGLE_TOKEN_KEY),
  getDevUserId: () => readRuntimeDevUserId(),
  setDevUserId: (userId: string) => writeStorage(DEV_USER_ID_KEY, userId),
  clearDevUserId: () => removeStorage(DEV_USER_ID_KEY),
  clearAll: () => {
    removeStorage(GOOGLE_TOKEN_KEY);
    removeStorage(DEV_USER_ID_KEY);
  },
  hasAuthCredentials: () =>
    Boolean(
      readRuntimeGoogleIdToken() ||
        readRuntimeDevUserId() ||
        readConfiguredGoogleIdToken() ||
        readConfiguredDevUserId()
    ),
};

export const graphqlEndpoint = resolveGraphQLEndpoint();

const httpLink = new HttpLink({
  uri: graphqlEndpoint,
});

const toHeaderRecord = (headers: unknown): Record<string, string> => {
  if (!headers) {
    return {};
  }
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  return headers as Record<string, string>;
};

const authLink = new SetContextLink((prevContext) => {
  const runtimeToken = readRuntimeGoogleIdToken();
  const runtimeDevUserId = readRuntimeDevUserId();
  const googleToken = runtimeToken || readConfiguredGoogleIdToken();
  const devUserId = runtimeDevUserId || readConfiguredDevUserId();
  const headers = toHeaderRecord(prevContext.headers);

  return {
    headers: {
      ...headers,
      ...(googleToken ? { authorization: `Bearer ${googleToken}` } : {}),
      ...(devUserId ? { "x-user-id": devUserId } : {}),
    },
  };
});

const errorLink = new ErrorLink(({ error }) => {
  let unauthenticated = false;

  if (CombinedGraphQLErrors.is(error)) {
    unauthenticated = error.errors.some(
      (graphQLError) => graphQLError.extensions?.code === "UNAUTHENTICATED"
    );
  }

  const message = typeof error?.message === "string" ? error.message : "";
  if (!unauthenticated && message.includes("UNAUTHENTICATED")) {
    unauthenticated = true;
  }
  const isStoreResetCancellation = message.includes(
    "Store reset while query was in flight"
  );

  if (unauthenticated && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fairshare:unauthenticated"));
  }

  if (!unauthenticated && !isStoreResetCancellation) {
    console.error("[GraphQL error]", error);
  }
});

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: ApolloLink.from([errorLink, authLink, httpLink]),
});
