import { GraphQLError } from "graphql";

export const appError = (message: string, code: string) =>
  new GraphQLError(message, {
    extensions: { code },
  });
