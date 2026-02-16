import { ApolloClient, InMemoryCache } from "@apollo/client/core";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";
import { SetContextLink } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { HttpLink } from "@apollo/client/link/http";

const GOOGLE_TOKEN_KEY = "fairshare.googleIdToken";
const DEV_USER_ID_KEY = "fairshare.devUserId";

const resolveGraphQLEndpoint = () => {
  const configuredEndpoint = process.env.REACT_APP_GRAPHQL_ENDPOINT;

  if (typeof window !== "undefined" && window.location.hostname.includes("-3000.csb.app")) {
    const sandboxEndpoint = `${window.location.protocol}//${window.location.hostname.replace("-3000.csb.app", "-4000.csb.app")}/graphql`;
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

export const authStorage = {
  getGoogleIdToken: () => readStorage(GOOGLE_TOKEN_KEY),
  setGoogleIdToken: (token: string) => writeStorage(GOOGLE_TOKEN_KEY, token),
  clearGoogleIdToken: () => removeStorage(GOOGLE_TOKEN_KEY),
  getDevUserId: () => readStorage(DEV_USER_ID_KEY),
  setDevUserId: (userId: string) => writeStorage(DEV_USER_ID_KEY, userId),
  clearDevUserId: () => removeStorage(DEV_USER_ID_KEY),
  clearAll: () => {
    removeStorage(GOOGLE_TOKEN_KEY);
    removeStorage(DEV_USER_ID_KEY);
  },
  hasAuthCredentials: () =>
    Boolean(
      readStorage(GOOGLE_TOKEN_KEY) ||
        readStorage(DEV_USER_ID_KEY) ||
        process.env.REACT_APP_GOOGLE_ID_TOKEN ||
        process.env.REACT_APP_DEV_USER_ID,
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
  const runtimeToken = authStorage.getGoogleIdToken();
  const runtimeDevUserId = authStorage.getDevUserId();
  const googleToken = runtimeToken || process.env.REACT_APP_GOOGLE_ID_TOKEN || "";
  const devUserId = runtimeDevUserId || process.env.REACT_APP_DEV_USER_ID || "";
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
      (graphQLError) => graphQLError.extensions?.code === "UNAUTHENTICATED",
    );
  }

  const message = typeof error?.message === "string" ? error.message : "";
  const isStoreResetCancellation = message.includes("Store reset while query was in flight");

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
