import "reflect-metadata";
import { GraphQLSchema } from "graphql";
import { AuthChecker, buildSchemaSync } from "type-graphql";
import { MutationResolver } from "./graphql/resolvers/mutationResolver";
import { QueryResolver } from "./graphql/resolvers/queryResolver";
import { appError } from "./lib/errors";
import { GraphQLContext } from "./types";

const authChecker: AuthChecker<GraphQLContext> = ({ context }) => {
  if (!context.viewer) {
    throw appError("Authentication required.", "UNAUTHENTICATED");
  }
  return true;
};

let cachedSchema: GraphQLSchema | undefined;

export const getSchema = (): GraphQLSchema => {
  if (cachedSchema) {
    return cachedSchema;
  }

  cachedSchema = buildSchemaSync({
    resolvers: [QueryResolver, MutationResolver],
    authChecker,
    validate: false,
  });

  return cachedSchema;
};
